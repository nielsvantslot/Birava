/**
 * A durable queue for check-ins that couldn't be submitted (offline, or the
 * app was closed mid-submit). Raw IndexedDB — no dependency exists for this
 * yet in the repo. The photo is stored as an ArrayBuffer rather than a Blob:
 * more consistently reliable across Safari/WebKit versions than storing
 * Blob/File objects directly in IndexedDB.
 *
 * Every mutation dispatches a `window` CustomEvent so listeners (the
 * auto-sync component, the cancellation panel) can react without polling —
 * same bus pattern as components/ui/toast-pill.tsx.
 */

import type { DrinkType } from "@/lib/types";

const DB_NAME = "birava-offline";
const DB_VERSION = 1;
const STORE_NAME = "pending-checkins";
const CHANGE_EVENT = "birava:pending-checkins-changed";

export type PendingCheckinPhoto =
  | { kind: "none" }
  | { kind: "uploaded"; url: string; lqip: string | null }
  | { kind: "raw"; arrayBuffer: ArrayBuffer; type: string; name: string };

export type PendingCheckinPayload = {
  drinkName: string | null;
  drinkType: DrinkType;
  venue: string | null;
  lat: number | null;
  lng: number | null;
};

export type PendingCheckin = {
  id: string;
  /**
   * Whoever was logged in when this entry was queued — not just metadata,
   * but the thing getAllPendingCheckins filters by. This store is a single
   * shared IndexedDB database per *device/browser*, not per account: without
   * this, a shared or handed-off device (a different person logging in
   * after a previous user logged out, or logs out while something is still
   * queued) would flush the previous user's still-queued check-in — with
   * its real drinkName/venue/photo — as a brand-new entry under whoever is
   * logged in when the next sync trigger fires. Optional only for entries
   * that predate this field (queued by a build shipped before this fix);
   * getAllPendingCheckins treats a missing userId as belonging to whoever
   * asks, matching this field's absence in behavior before this fix existed
   * — required here (so every new call site is compiler-enforced to supply
   * it) even though an already-stored pre-fix record won't actually have it
   * at runtime; getAllPendingCheckins is written defensively against that.
   */
  userId: string;
  createdAt: number;
  status: "queued" | "syncing" | "failed";
  lastError?: string;
  payload: PendingCheckinPayload;
  photo: PendingCheckinPhoto;
};

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);

  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      // Safari private-browsing (and similar) can reject IDB entirely —
      // degrade to "no offline queue" rather than throwing.
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function emitChange(): void {
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

/** Subscribe to any add/update/remove. Returns an unsubscribe function. */
export function onPendingCheckinsChanged(callback: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, callback);
  return () => window.removeEventListener(CHANGE_EVENT, callback);
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, mode);
      const request = run(tx.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function addPendingCheckin(entry: Omit<PendingCheckin, "status"> & { status?: PendingCheckin["status"] }): Promise<void> {
  const full: PendingCheckin = { status: "queued", ...entry };
  await withStore("readwrite", (store) => store.put(full));
  emitChange();
}

/**
 * Scoped to `userId` — this store is one shared IndexedDB database per
 * device/browser, not per account (see PendingCheckin.userId's own comment).
 * An entry with no `userId` at all predates this field (queued by a build
 * shipped before this fix) and is returned to whoever asks, matching this
 * function's behavior before the field existed — everything queued since
 * this fix shipped always has one, so this only ever matters for a brief
 * transition window right after deploy.
 */
export async function getAllPendingCheckins(userId: string): Promise<PendingCheckin[]> {
  const entries = (await withStore<PendingCheckin[]>("readonly", (store) => store.getAll())) ?? [];
  return entries
    .filter((e) => e.userId === userId || e.userId === undefined)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function updatePendingCheckin(
  id: string,
  patch: Partial<Pick<PendingCheckin, "status" | "lastError" | "photo">>
): Promise<void> {
  const db = await openDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const getRequest = store.get(id);
      getRequest.onsuccess = () => {
        const existing = getRequest.result as PendingCheckin | undefined;
        if (existing) store.put({ ...existing, ...patch });
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
  emitChange();
}

export async function removePendingCheckin(id: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(id));
  emitChange();
}
