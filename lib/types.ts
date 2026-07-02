export type Profile = {
  id: string;
  username: string;
  avatar_url: string | null;
  created_at: string;
};

export type Group = {
  id: string;
  name: string;
  invite_code: string;
  owner_id: string;
  created_at: string;
};

export type GroupMember = {
  group_id: string;
  user_id: string;
  joined_at: string;
  profiles?: Profile;
  groups?: Group;
};

export type BeerEntry = {
  id: string;
  user_id: string;
  group_id: string | null;
  beer_name: string | null;
  brewery: string | null;
  style: string | null;
  amount: number;
  notes: string | null;
  created_at: string;
  profiles?: Profile;
};

export type Achievement = {
  id: string;
  label: string;
  description: string;
  emoji: string;
  threshold: number;
};

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first_beer",
    label: "First Beer",
    description: "Logged your first beer!",
    emoji: "🍺",
    threshold: 1,
  },
  {
    id: "ten_beers",
    label: "10 Beers",
    description: "10 beers down!",
    emoji: "🍻",
    threshold: 10,
  },
  {
    id: "fifty_beers",
    label: "50 Beers",
    description: "50 beers legend!",
    emoji: "🏆",
    threshold: 50,
  },
  {
    id: "marathon",
    label: "Beer Marathon",
    description: "100 beers - you're unstoppable!",
    emoji: "🎖️",
    threshold: 100,
  },
];

export type LeaderboardEntry = {
  user_id: string;
  username: string;
  avatar_url: string | null;
  total: number;
  today: number;
  avg_per_day: number;
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

export type FeedEntry = {
  id: string;
  user_id: string;
  group_id: string | null;
  beer_name: string | null;
  brewery: string | null;
  style: string | null;
  amount: number;
  notes: string | null;
  created_at: string;
  username: string;
  avatar_url: string | null;
};

export type PublicProfile = {
  id: string;
  username: string;
  avatar_url: string | null;
  member_since: string;
  total_beers: number;
  streak_days: number;
};
