import type { PendingCheckin } from "./PendingCheckin";

/**
 * Where queued check-ins live. The web app uses IndexedDB; a React Native
 * client plugs in SQLite or MMKV by implementing this. A storage that cannot
 * work (IndexedDB blocked in private browsing) degrades to "nothing queued"
 * rather than throwing.
 */
export interface IOutboxStorage {
  /** Entries belonging to `userId` (plus any that predate user scoping), oldest first. */
  getAll(userId: string): Promise<PendingCheckin[]>;
  add(entry: Omit<PendingCheckin, "status"> & { status?: PendingCheckin["status"] }): Promise<void>;
  update(id: string, patch: Partial<Pick<PendingCheckin, "status" | "lastError" | "photo">>): Promise<void>;
  remove(id: string): Promise<void>;
}
