# Brava 🍺

> Strava, but for beer. Track your holiday beers, compete with friends, earn achievements.

Brava is a mobile-first PWA built with Next.js, Supabase, and Tailwind CSS. Log beers, see stats, run a holiday leaderboard, and install it on your phone's home screen.

---

## Features

- 🍺 **Quick Beer Logging** — Log a beer in 2 taps with optional name, brewery, style, and notes
- 📊 **Dashboard** — Total beers, today's count, streak, and avg/day at a glance
- 📋 **History** — Full chronological list grouped by day with edit/delete
- 📈 **Statistics** — Recharts graphs: beers per day, beer styles pie, top breweries
- 🏆 **Leaderboard** — Holiday group ranking by total beers
- 👥 **Groups** — Create or join a shared group with a 6-char invite code
- 🏅 **Achievements** — First Beer, 10 Beers, 50 Beers, Beer Marathon + confetti
- 📱 **PWA** — Installable on iOS/Android, offline support, app icons, splash screen
- 🌙 **Dark Mode** — Auto dark/light based on system preference

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| UI Components | Custom shadcn-style components |
| Database | Supabase (Postgres + Auth + RLS) |
| Charts | Recharts |
| Animations | Framer Motion |
| Confetti | canvas-confetti |
| PWA | next-pwa |
| Deploy | Vercel |

---

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/nielsvantslot/Brava.git
cd Brava
npm install
```

### 2. Create and link a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Install and authenticate Supabase CLI:

```bash
npx supabase login
```

3. Link this repo to your project:

```bash
npx supabase link --project-ref your-project-ref
```

4. Copy your project URL and anon key from **Settings → API**

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Run locally

```bash
npm run dev
```

`npm run dev` now automatically runs `supabase db push` first, so pending migrations in `supabase/migrations/` are applied without manually pasting SQL in the Supabase SQL editor.

Open [http://localhost:3000](http://localhost:3000).

---

## Deploy to Vercel

### Option A – Vercel CLI

```bash
npm install -g vercel
vercel --prod
```

Set the environment variables in Vercel dashboard under **Settings → Environment Variables**:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |

### Option B – GitHub Integration

1. Push to GitHub
2. Import repo on [vercel.com/new](https://vercel.com/new)
3. Add environment variables
4. Deploy

---

## PWA Installation

### iOS (Safari)
1. Open the app in Safari
2. Tap the **Share** button
3. Tap **Add to Home Screen**

### Android (Chrome)
1. Open the app in Chrome
2. Tap the **⋮** menu
3. Tap **Add to Home screen** or look for the install prompt

---

## Database Schema

```
profiles
  id            uuid PK (FK → auth.users)
  username      text UNIQUE
  avatar_url    text
  created_at    timestamptz

groups
  id            uuid PK
  name          text
  invite_code   text UNIQUE (6 chars)
  created_at    timestamptz

group_members
  group_id      uuid FK → groups
  user_id       uuid FK → auth.users
  joined_at     timestamptz
  PRIMARY KEY (group_id, user_id)

beer_entries
  id            uuid PK
  user_id       uuid FK → auth.users
  group_id      uuid FK → groups (nullable)
  beer_name     text
  brewery       text
  style         text
  amount        numeric (default 1)
  notes         text
  created_at    timestamptz
```

All tables have Row Level Security enabled. Users can only read/write their own data, with exceptions for group members who can view each other's beer entries.

---

## Project Structure

```
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx       Sign-in page
│   │   └── signup/page.tsx      Sign-up page
│   ├── (app)/
│   │   ├── layout.tsx           Authenticated shell (TopBar + BottomNav + FAB)
│   │   ├── dashboard/page.tsx   Home dashboard with stats
│   │   ├── history/page.tsx     Full beer log
│   │   ├── stats/page.tsx       Recharts statistics
│   │   ├── leaderboard/page.tsx Group leaderboard
│   │   └── groups/page.tsx      Create/join groups
│   ├── layout.tsx               Root layout with PWA metadata
│   └── globals.css              Theme variables + Tailwind
├── components/
│   ├── ui/                      Button, Card, Dialog, Input, etc.
│   ├── beer/                    BeerCard, AddBeerDialog, StatCard, StatsCharts
│   └── layout/                  TopBar, BottomNav, AddBeerFab
├── lib/
│   ├── supabase/                client.ts, server.ts, middleware.ts
│   ├── types.ts                 TypeScript types
│   ├── utils.ts                 Utility functions
│   └── achievements.ts          Achievement logic + confetti
├── middleware.ts                 Auth redirect middleware
├── supabase/
│   ├── migrations/              Versioned SQL migrations used by Supabase CLI
│   └── schema.sql               Canonical schema reference
└── public/
    ├── manifest.json             PWA manifest
    └── icons/                   App icons (72–512px)
```

---

## Achievements

| Badge | Requirement |
|-------|-------------|
| 🍺 First Beer | Log 1 beer |
| 🍻 10 Beers | Log 10 beers total |
| 🏆 50 Beers | Log 50 beers total |
| 🎖️ Beer Marathon | Log 100 beers total |

Confetti fires automatically when you hit a milestone!

---

## License

MIT – have fun and drink irresponsibly 🍺
