"use client";

import { useEffect, useState } from "react";
import { ApiClient } from "@/lib/gateway/ApiClient";
import type { DrinkSuggestionsDTO } from "@/modules/checkins/server/drinkReads";

/**
 * Autocomplete suggestions from the user's own recent check-ins. Fetched after
 * the form has already rendered, same "silent enrichment, never blocks"
 * pattern as geolocation — a fresh check-in benefits from a habitual
 * drink/venue being one tap away instead of retyped, but nothing here should
 * hold up the form's own initial paint.
 */
export function useDrinkSuggestions(editing: boolean) {
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);
  const [venueSuggestions, setVenueSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (editing) return;
    ApiClient.get<DrinkSuggestionsDTO>("/api/drink-suggestions")
      .then(({ names, venues }) => {
        setNameSuggestions(names);
        setVenueSuggestions(venues);
      })
      .catch(() => {});
  }, [editing]);

  return { nameSuggestions, venueSuggestions };
}
