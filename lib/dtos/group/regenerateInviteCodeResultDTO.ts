export class RegenerateInviteCodeResultDTO {
  declare error?: string;
  declare inviteCode?: string;
  /** See ActionResultDTO.revalidatedPaths. */
  declare revalidatedPaths?: string[];
}
