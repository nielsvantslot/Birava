/** What an upload answers with: the stored photo, or why it was rejected (and whether trying again could help). */
export type OutboxPhotoUpload = { url: string; lqip: string | null } | { error: string; retryable?: boolean };

/** Uploads a queued check-in's raw photo bytes. The web implementation builds a File and uses the browser upload client. */
export interface IOutboxPhotoUploader {
  uploadRaw(photo: { arrayBuffer: ArrayBuffer; type: string; name: string }, userId: string): Promise<OutboxPhotoUpload>;
}
