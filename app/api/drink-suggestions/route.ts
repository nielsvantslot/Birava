import { gateway } from "@/modules/identity/server/gateway";
import { getMyDrinkSuggestions } from "@/modules/checkins/server/drinkReads";

// Recent drink names and venues for the log form's autocomplete.
export const GET = gateway.route.authed({ name: "drink-suggestions.get" }, () => getMyDrinkSuggestions());
