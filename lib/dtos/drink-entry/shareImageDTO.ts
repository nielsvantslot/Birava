/** The share-image route's response contract: both recap variants as data URIs. */
export class ShareImageDTO {
  declare opaque: string;
  declare transparent: string;
}
