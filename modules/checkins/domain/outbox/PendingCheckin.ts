import type { DrinkType } from "@/lib/types";

/** The photo of a queued check-in: none, already uploaded, or still the raw bytes. Bytes are an ArrayBuffer (more reliable across Safari/WebKit versions than a Blob in IndexedDB, and storable by any engine). */
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
   * but the thing the storage filters by. The queue is shared by everyone who
   * uses the device, not per account: without this, a shared or handed-off
   * device (a different person logging in after a previous user logged out,
   * or logs out while something is still queued) would flush the previous
   * user's still-queued check-in — with its real drinkName/venue/photo — as a
   * brand-new entry under whoever is logged in when the next sync trigger
   * fires. A stored record from before this field existed has none at runtime;
   * storage implementations treat a missing userId as belonging to whoever
   * asks, matching behaviour before the field existed.
   */
  userId: string;
  createdAt: number;
  status: "queued" | "syncing" | "failed";
  lastError?: string;
  payload: PendingCheckinPayload;
  photo: PendingCheckinPhoto;
};
