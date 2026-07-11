export class CreateDrinkEntryDTO {
  declare drinkName: string | null;
  declare drinkType: string;
  declare venue: string | null;
  declare lat: number | null;
  declare lng: number | null;
  declare notes: string | null;
  declare photoUrl: string | null;
  declare photoLqip: string | null;
}
