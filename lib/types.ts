export type Profile = {
  id: string;
  username: string;
  avatar_url: string | null;
  created_at: string;
};

/** The drink types a check-in can be logged as. */
export const DRINK_TYPES = ["Beer", "Wine", "Cocktail", "Other"] as const;
export type DrinkType = (typeof DRINK_TYPES)[number];

/**
 * One check-in — a single logged drink. Check-ins auto-group into
 * sessions (lib/sessions.ts), the unit the app is built around.
 */
export type DrinkEntry = {
  id: string;
  user_id: string;
  drink_name: string | null;
  drink_type: string;
  venue: string | null;
  lat: number | null;
  lng: number | null;
  notes: string | null;
  photo_url: string | null;
  photo_lqip: string | null;
  created_at: string;
  profiles?: Profile;
};

export type Follow = {
  follower_id: string;
  following_id: string;
  created_at: string;
};

export type FollowCounts = {
  followers: number;
  following: number;
};
