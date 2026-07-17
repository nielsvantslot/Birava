/** The avatar upload route's JSON response: the new avatar URL, or an error. */
export class AvatarUploadResultDTO {
  declare url?: string;
  declare error?: string;
}
