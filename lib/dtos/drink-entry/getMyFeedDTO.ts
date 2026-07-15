export class GetMyFeedDTO {
  /** true = the "You" tab (own check-ins only); false = viewer + followed. */
  declare onlyOwn: boolean;
  /** Keyset cursor for the next page — both set, or neither. */
  declare beforeEndedAt?: string;
  declare beforeId?: string;
}
