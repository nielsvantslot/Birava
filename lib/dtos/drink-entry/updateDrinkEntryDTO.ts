import type { DrinkType } from "@/lib/types";

export class UpdateDrinkEntryDTO {
  declare id: string;
  declare drinkName: string | null;
  declare drinkType: DrinkType;
  declare venue: string | null;
  declare lat: number | null;
  declare lng: number | null;
  declare photoUrl: string | null;
  declare photoLqip: string | null;
}
