/** Result of a cleanupOrphanedBlobs sweep — how many blobs it looked at, removed, and failed to remove. */
export class BlobCleanupResultDTO {
  declare scanned: number;
  declare deleted: number;
  declare failed: number;
}
