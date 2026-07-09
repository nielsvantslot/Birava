# Birava 🍺

> Strava, but for beer. Track your holiday beers, compete with friends, earn achievements.

Birava is a mobile-first PWA built with Next.js, Prisma, PostgreSQL, and Tailwind CSS. Log beers, see stats, run a holiday leaderboard, and install it on your phone's home screen.

---

## Features

- 🍺 **Quick Beer Logging** — Log a beer in 2 taps with optional name, brewery, style, and notes
- 📊 **Dashboard** — Total beers, today's count, streak, and avg/day at a glance
- 📋 **History** — Full chronological list grouped by day with edit/delete
- 📈 **Statistics** — Recharts graphs: beers per day, beer styles pie, top breweries
- 🏆 **Board + Groups** — Holiday rankings plus create/join group management in one page
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
| Database | PostgreSQL + Prisma ORM |
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

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL=postgresql://birava:birava@localhost:5432/birava?schema=public
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Start local Postgres with Docker

```bash
npm run db:up
```

### 4. Run migrations and start locally

```bash
npm run db:migrate:dev
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Run app + database fully in Docker (with hot reload)

```bash
npm run docker:up
```

Then open [http://localhost:3000](http://localhost:3000).

The app service bind-mounts your source code and runs Next.js in dev mode with polling enabled, so code changes auto-reload even when running in Docker Desktop.
The first startup can take a bit longer because dependencies are installed in the container volume; subsequent starts reuse that cache and are much faster.

Useful commands:

```bash
npm run docker:logs
npm run docker:down
```

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
| `DATABASE_URL` | Your production Postgres connection string |
| `NEXT_PUBLIC_APP_URL` | Your app URL (e.g. `https://your-domain.com`) |

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

Data access is handled in app logic and server actions using Prisma.

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
│   │   ├── leaderboard/page.tsx Combined board and group management
│   │   └── groups/page.tsx      Redirects to leaderboard
│   ├── layout.tsx               Root layout with PWA metadata
│   └── globals.css              Theme variables + Tailwind
├── components/
│   ├── ui/                      Button, Card, Dialog, Input, etc.
│   ├── beer/                    BeerCard, AddBeerDialog, StatCard, StatsCharts
│   └── layout/                  TopBar, BottomNav, AddBeerFab
├── lib/
│   ├── auth/                    session + password helpers
│   ├── db.ts                    Prisma client singleton
│   ├── types.ts                 TypeScript types
│   ├── utils.ts                 Utility functions
│   └── achievements.ts          Achievement logic + confetti
├── prisma/
│   ├── schema.prisma            Prisma schema
│   └── migrations/              SQL migrations used by Prisma
├── docker-compose.yml            Local PostgreSQL service
├── middleware.ts                 Auth redirect middleware
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
