/** The expected JSON body of a POST to the finalize route — the raw upload's URL from the direct-upload step. */
export interface FinalizeUploadRequestDto {
  readonly url: string;
}
