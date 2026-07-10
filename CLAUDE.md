# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

Birava is a mobile-first PWA — "Strava for beer." Next.js 15.5 (App Router) + React 19, Prisma + PostgreSQL, Tailwind v4, custom shadcn-style UI. Deploys to Vercel.

## Everything runs in Docker

There is **no local `node_modules`** — the whole stack runs in containers via `docker compose`. Run Prisma and Node commands inside the `birava-app` container, not on the host.

```bash
npm run docker:up      # build + start app (:3000) and db together, hot-reload
npm run docker:logs    # follow app + db logs
npm run docker:down    # stop
npm run db:up          # start ONLY Postgres (host port 5433 → container 5432)
npm run lint           # eslint (host is fine for lint)
```

- **Prisma always runs in the container**: `docker exec birava-app npm run prisma:generate`, `docker exec birava-app npm run db:migrate:dev`. Host `npx prisma` downloads Prisma 7, which rejects this schema (pinned to 6.16.2).
- **After `prisma generate`, `docker restart birava-app`.** The running dev server holds the old client in memory; new columns come back `undefined` until restart. A passing `tsc` proves nothing about the running process.
- **Typecheck**: `docker exec birava-app npx tsc --noEmit`.
- **DB access**: `docker exec -i birava-postgres psql -U birava -d birava` (the `-i` is required for heredocs, else the SQL is silently dropped).
- Container startup runs `prisma generate` + `db:migrate` automatically on boot.

### Docker gotchas (from prior sessions)
- **Stale service worker served old JS through hard reloads / restarts / `.next` wipes.** Fixed: `components/service-worker-registration.tsx` is prod-only and unregisters + clears caches in dev. If a browser still acts stale: DevTools → Application → Service Workers → Unregister.
- **Truncated-file "syntax errors"** (`Expected '</', got '<eof>'`) during rapid multi-file edits are a Turbopack + macOS bind-mount partial read, not a real error. Fix with `touch <file>`; after a multi-file editing burst it hits many files at once — `docker restart birava-app` flushes them all in one go.
- If "missing expected function export" errors persist after renames: `docker rm birava-app` (must be removed, not just stopped), `docker volume rm birava_birava-next-cache`, then `docker compose up -d app`.

## Auth architecture (custom, not Supabase / NextAuth)

The repo was migrated off Supabase to direct Prisma. Auth is a hand-rolled session-cookie system:

- **`birava_session` httpOnly cookie → `Session` table** (`lib/auth/session.ts`). `getCurrentUser()` is React-`cache`d and is the **single auth entry point** for all pages and server actions.
- **`middleware.ts` at repo root** does the login/redirect gate. It explicitly opts into the **Node.js runtime** via `export const runtime = "nodejs"` (Node-runtime middleware stabilized in Next 15.5; the default edge runtime crashes on Prisma). It delegates to `lib/auth/proxy-session.ts`, which does a cheap session-existence check on every matched request.
- Do not remove `export const runtime = "nodejs"` from `middleware.ts` or add edge-runtime DB queries — Prisma cannot run on the edge runtime.
- (Repo history note: this file was briefly named `proxy.ts` during a short-lived Next.js 16 upgrade — see "Next.js 16 downgrade" below. `proxy.ts` was Next 16's rename of `middleware.ts`.)

## Birava 2.0 product invariants (hold these in every change)

The app is the **Birava 2.0** redesign (spec: `BIRAVA-2.0-HANDOFF.md` in the claude.ai/design project; see HANDOFF.md). Non-negotiables:

- **The session is the hero unit.** A check-in (one logged drink) is the input; check-ins auto-group into sessions by a **4-hour inactivity gap** (locked rule, `lib/sessions.ts`, `SESSION_GAP_MS`). Sessions are *computed, never stored* — a session's id is its first check-in's id (`/sessions/[id]` re-groups around that anchor). No manual start/end.
- **Vocabulary (exact):** log (verb) / check-in / session / crew / leaderboard (only the ranking *inside* a crew). Copy says "drink", not "beer" (marketing may say beer). Wrong-code error is exactly "That code doesn't match any crew." Sentence case; no emoji anywhere in UI copy.
- **Accent discipline is a correctness bug if wrong:** `--accent` = actions + the current user's own data only; other people render in `--ink`. `--honey` = achievements only.
- **Celebrate variety, never volume:** no drink-count achievements, no avg/day/hour anywhere, crew leaderboards score **since each member joined** (`lib/crews.ts`), streak = **active weeks** with rest-week/recovery framing. Ratings are stripped app-wide (the `rating` column exists but is unused — don't resurface it without a product call). Never show a streak at the moment of logging.
- **PARKED (never build):** pace/avg-per-hour metrics, or any "you're drinking fast" nudge — the app does not editorialize the user's drinking.

## Data flow: Prisma rows → snake_case DTOs

Components never consume Prisma rows directly. The boundary is `lib/mappers.ts`:

- Prisma models are **camelCase** (`beerName`, `avatarUrl`); the DTO types in **`lib/types.ts` are snake_case** (`beer_name`, `avatar_url`) — a leftover Supabase convention that the whole component layer depends on. Keep new fields consistent with this split.
- Mappers also convert Prisma `Decimal` → `number` (`amount`, `lat`, `lng`). Forgetting this leaks `Decimal` objects into the UI.
- **Server actions** live in `lib/actions/*.ts` (`"use server"`). They call `getCurrentUser()` for auth, mutate via `db`, then `revalidatePath(...)` the affected routes (see the `CHECKIN_PATHS` pattern in `lib/actions/beer.ts`). Server-only *read* helpers that take a caller-supplied user id (e.g. `lib/proost.ts`) must NOT live in `"use server"` files — every export there becomes a POST endpoint.

## Time zones: never compute day/week math in server TZ

All date/day/week logic goes through `lib/dates.ts`, parameterized by the user's IANA time zone. `components/timezone-sync.tsx` writes the browser TZ to a `birava_tz` cookie (and refreshes once); server components read it via `getUserTimeZone()` (`lib/timezone.ts`). Session titles, "Today/Yesterday", the active-weeks streak, and week buckets all use this. Don't call `new Date().getHours()`/`toLocaleDateString()` without a TZ — that's the class of bug the 2.0 rebuild removed.

## Schema notes (`prisma/schema.prisma`)
- `User` is the profile (no separate profiles table). Fields use `@map` to snake_case columns; `BeerEntry`/`Proost` columns are camelCase — check the migration SQL before writing raw queries.
- `BeerEntry` = a check-in: `drinkType` (Beer/Wine/Cocktail/Other, `DRINK_TYPES` in `lib/types.ts`), optional `venue`, `lat`/`lng` (`Decimal(9,6)`), `notes`, `photoUrl`. `rating`/`style`/`brewery`/`amount` are legacy columns no longer written by the UI.
- `Proost` = kudos on a session, keyed `[entryId, userId]` where `entryId` is the session's anchor (first) check-in.
- `BeerEntry.groupId` exists but crew-scoped logging is **not wired** — it is effectively always null; crew scoring instead filters by `GroupMember.joinedAt`.

## Demo seed (`prisma/seed.ts`)

A committed, idempotent seed builds the **Demobeer** showcase account (email `jairo12.jn@gmail.com`, password `Test123!`) with a full demo dataset (multi-venue photo session, lone check-in, all 4 drink types, a Local Legend venue, an active-weeks streak, a 3-member crew, followed users). Images live in `prisma/seed-assets/` and are uploaded through the storage abstraction, so they land in Vercel Blob on staging and on local disk in dev.

- **Runs automatically on Vercel staging/preview** — `vercel.json`'s build command chains `db:seed`, and the script self-guards: it runs only when `VERCEL_ENV=preview` or `SEED_DEMO=true`, never on production, and is a no-op on a normal local dev DB.
- **Idempotent + safe** — skips if the demo account already has data, and refuses to touch the email if it belongs to a non-`Demobeer` user (so it won't clobber a real local account that happens to share the email).
- **Run locally**: `docker exec -e SEED_DEMO=true birava-app npm run db:seed` (needs a DB where that email is free — locally it's taken by `SlayerofBeers`, so use a fresh DB to preview Demobeer).

## Route map
- Tabs: `/dashboard` (merged session feed) · `/stats` · `/log` (create + edit via `?edit=<id>`) · `/crews` (+ `/crews/[id]`) · `/profile`. Off-nav: `/sessions/[id]`, `/achievements`, `/people`, `/profile/[username]`.
- Folded legacy: `/history` and `/feed` are gone (404); `/leaderboard`, `/leaderboard/[groupId]`, `/groups` redirect into `/crews`. Don't re-add them.

## Next.js 16 downgrade (2026-07-10)

The app briefly ran on Next.js 16.2.9 (with `cacheComponents: true`) but was downgraded back to **Next.js 15.5.20** after hitting a confirmed, unfixable-from-app-code upstream Next 16 bug: `next build` unconditionally crashed prerendering the auto-generated `/_global-error` page (`TypeError: Cannot read properties of null (reading 'useContext')`, `next/link`'s `AppRouterContext` null during that SSR pass — see vercel/next.js#86178, #85668, #84994). Reproduced with cacheComponents on/off, with a custom `global-error.tsx`, and on the `16.3.0-canary` line; no workaround existed upstream at the time.

- `cacheComponents` is **removed** from `next.config.ts` — this repo doesn't use `use cache`/`cacheLife`, so there was nothing to migrate back to route-segment configs.
- `proxy.ts` → `middleware.ts` (see "Auth architecture" above) — Next 15.5 stabilized Node-runtime middleware, so the Prisma-on-edge-crash problem `proxy.ts` solved is still solved, just via the older file convention + an explicit `export const runtime = "nodejs"`.
- `app/global-error.tsx`'s reset callback is the classic `reset` prop, not Next 16.2's `unstable_retry`.
- If re-attempting a Next 16 upgrade later, check whether vercel/next.js#86178 (or its duplicates) has actually been fixed upstream before assuming `next build` will succeed — don't rediscover this from scratch.

## Known landmines (see `docs/audit/` for the full reports)
- **Uploads write to `public/uploads/` on the local filesystem** (`lib/storage/local.ts`) — this breaks on Vercel's ephemeral/read-only FS. No magic-byte/size validation yet.
- **`app/api/auth/forgot-password/route.ts`** returns the reset URL/token in the HTTP response (account-takeover risk) — gate before deploy.
- **Open product calls** (flagged 2026-07-09, don't silently decide): active-weeks streak grace rule (currently: one rest week survives, 2+ consecutive end the run — `activeWeeks()` in `lib/sessions.ts`); Countries/Passport badges omitted for lack of country data ("Types tried" substituted); comments are a "soon" toast stub (proost is real).
- Dev DB contains seeded demo users (`designtest`/`sarah_pours`/`niels_hop`, pw `designtest123`, plus `audit_user`) — Jairo's real account is `SlayerofBeers`; never modify it.

## Maps without a library
`components/beer/session-map.tsx` renders a static route map as **server-side SVG** — hand-computed Web Mercator tile math with dark CARTO tiles as `<image>`, no map library and no API key. Geolocation needs HTTPS (fine on Vercel).
