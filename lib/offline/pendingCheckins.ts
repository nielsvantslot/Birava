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
  drinkType: string;
  venue: string | null;
  lat: number | null;
  lng: number | null;
  notes: string | null;
};

export type PendingCheckin = {
  id: string;
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

export async function getAllPendingCheckins(): Promise<PendingCheckin[]> {
  const entries = (await withStore<PendingCheckin[]>("readonly", (store) => store.getAll())) ?? [];
  return entries.sort((a, b) => a.createdAt - b.createdAt);
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
