/** The JSON body returned by the upload/finalize routes on success. */
export interface UploadResultDto {
  readonly url: string;
  readonly lqip: string | null;
}
