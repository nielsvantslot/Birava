export class AddDrinkResultDTO {
  declare error?: string;
  declare achievementUnlocked?: boolean;
  declare id?: string;
  /** See ActionResultDTO.revalidatedPaths. */
  declare revalidatedPaths?: string[];
}
