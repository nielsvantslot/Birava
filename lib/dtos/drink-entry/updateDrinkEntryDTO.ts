export class UpdateDrinkEntryDTO {
  declare id: string;
  declare drinkName: string | null;
  declare brewery: string | null;
  declare style: string | null;
  declare amount: number;
  declare notes: string | null;
  declare photoUrl: string | null;
  declare createdAt: string;
}
