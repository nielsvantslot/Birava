import type { Locator } from "@playwright/test";

/** The /log screen — create/edit a check-in, plus its Pending sync panel. */
export interface ILogDrinkPage {
  goto(): Promise<void>;
  fillDrinkName(name: string): Promise<void>;
  attachPhoto(filePath: string): Promise<void>;
  removePhoto(): Promise<void>;
  submit(): Promise<void>;
  toast(): Locator;
  /** Locator, not a resolved boolean — callers assert with toBeVisible()/toBeHidden() for real retry-until-timeout polling. */
  pendingPanel(): Locator;
  cancelPending(drinkName: string): Promise<void>;
}
