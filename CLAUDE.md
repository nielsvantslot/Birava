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

- **The session is the hero unit.** A check-in (one logged drink) is the input; check-ins auto-group into sessions by a **4-hour inactivity gap** (locked rule, `lib/sessions.ts`, `SESSION_GAP_MS`). No manual start/end.
  - Sessions are a **real stored entity** (`DrinkSession` model, `prisma/schema.prisma`) — not computed on every read. `lib/commands/drinkEntryCommands.ts` maintains it incrementally on every check-in create/delete: attach to the session before/after, **merge** two sessions a backdated check-in bridges, **split** a session when deleting a middle check-in exposes a >4h gap, or start a new one.
  - A session's `id` is set once, to its anchor check-in's id at creation, and is **permanent** — it never changes even if a later backdated check-in becomes chronologically earlier. Existing `/sessions/[id]` links, share images, and `Comment`/`Cheer` rows (both FK'd to `DrinkSession`, not `DrinkEntry`) stay valid across merges/splits.
  - Check-in creation accepts a client-supplied `createdAt` (offline-sync recovering something logged in the past), clamped server-side to a 7-day trust window (`MAX_BACKDATE_MS`) since it's attacker-reachable input, not just the sync flow's.
  - `lib/sessions.ts`'s `groupIntoSessions()` (pure, in-memory) still exists and is still the right tool for aggregate-only screens (`/stats`, `/achievements`, streak/venue/type counts on profile) that never expose a `session.id` in a link — recomputing from already-fetched raw check-ins is free there. Any screen that renders a `/sessions/[id]` link or a Comment/Cheer key must go through `lib/queries/drinkSessionQueries.ts`'s DB-backed reads instead, since only the stored id is guaranteed correct post-backdating.
- **Vocabulary (exact):** log (verb) / check-in / session / crew / leaderboard (only the ranking *inside* a crew). Copy says "drink", not "beer" (marketing may say beer). Wrong-code error is exactly "That code doesn't match any crew." Sentence case; no emoji anywhere in UI copy.
- **Accent discipline is a correctness bug if wrong:** `--accent` = actions + the current user's own data only; other people render in `--ink`. `--honey` = achievements only.
- **Celebrate variety, never volume:** no drink-count achievements, no avg/day/hour anywhere, crew leaderboards score **since each member joined** (`lib/crews.ts`), streak = **active weeks** with rest-week/recovery framing. Ratings are stripped app-wide (the `rating` column exists but is unused — don't resurface it without a product call). Never show a streak at the moment of logging.
  - **Exception (2026-07-14, widened 2026-07-15, deliberate product call):** a **user-initiated session share card** may show that session's raw drink count and **pace as time-per-drink** (a Strava-style recap: route/map, duration, drink count, pace — see `app/api/sessions/[id]/share-image/route.tsx`). This is opt-in sharing, not ambient volume framing — the no-volume rule still holds everywhere else in the UI. The card does **not** show a separate variety/"types" stat (a lone check-in shows "Single check-in" instead of duration/pace, since there's no span to measure).
- **PARKED (never build):** pace/avg-per-hour metrics, or any "you're drinking fast" nudge, **anywhere except the user-initiated session share card** (2026-07-15 exception above) — the app does not editorialize the user's drinking in the ambient UI (feed, stats, profile).
- **Sharing your own session vs. someone else's is intentionally different:** your own session shares as the recap image (route/duration/drinks/pace) via `app/api/sessions/[id]/share-image/route.tsx`, which 404s for anyone but the owner. Sharing someone else's session only ever shares a link to `/sessions/[id]` — never their recap image or stats, so it can't be re-shared as if it were your own (`components/drink/social-row.tsx`'s `isOwner` branch).

## Data flow: Prisma rows → snake_case DTOs

Components never consume Prisma rows directly. The boundary is `lib/mappers.ts`:

- Prisma models are **camelCase** (`beerName`, `avatarUrl`); the DTO types in **`lib/types.ts` are snake_case** (`beer_name`, `avatar_url`) — a leftover Supabase convention that the whole component layer depends on. Keep new fields consistent with this split.
- Mappers also convert Prisma `Decimal` → `number` (`amount`, `lat`, `lng`). Forgetting this leaks `Decimal` objects into the UI.
- **Server actions** live in `lib/actions/*.ts` (`"use server"`). They call `getCurrentUser()` for auth, mutate via `db`, then `revalidatePath(...)` the affected routes (see the `CHECKIN_PATHS` pattern in `lib/actions/beer.ts`). Server-only *read* helpers that take a caller-supplied user id (e.g. `lib/proost.ts`) must NOT live in `"use server"` files — every export there becomes a POST endpoint.

## Time zones: never compute day/week math in server TZ

All date/day/week logic goes through `lib/dates.ts`, parameterized by the user's IANA time zone. `components/timezone-sync.tsx` writes the browser TZ to a `birava_tz` cookie (and refreshes once); server components read it via `getUserTimeZone()` (`lib/timezone.ts`). Session titles, "Today/Yesterday", the active-weeks streak, and week buckets all use this. Don't call `new Date().getHours()`/`toLocaleDateString()` without a TZ — that's the class of bug the 2.0 rebuild removed.

## Schema notes (`prisma/schema.prisma`)
- `User` is the profile (no separate profiles table). Fields use `@map` to snake_case columns; `DrinkEntry`/`DrinkSession`/`Cheer`/`Comment` columns are camelCase — check the migration SQL before writing raw queries.
- `DrinkEntry` = a check-in: `drinkType` (Beer/Wine/Cocktail/Other, `DRINK_TYPES` in `lib/types.ts`), optional `venue`, `lat`/`lng` (`Decimal(9,6)`), `notes`, `photoUrl`, required `sessionId` (see "The session is the hero unit" above). `rating`/`style`/`brewery`/`amount` are legacy columns no longer written by the UI.
- `DrinkSession` = a real session row (`id`, `userId`, `startedAt`, `endedAt`, `name`) — not the auth `Session` model (login sessions), a separate model entirely.
- `Cheer`/`Comment` are keyed by `sessionId` (FK to `DrinkSession`), not by a check-in id.
- `DrinkEntry.groupId` exists but crew-scoped logging is **not wired** — it is effectively always null; crew scoring instead filters by `GroupMember.joinedAt`.

## Image pipeline (`modules/photo-upload/`, `lib/photoUpload.ts`, `app/api/photos/[entryId]/route.ts`)

Uploads are resized/re-encoded, never stored raw. The pipeline itself is a self-contained, dependency-injected module — `modules/photo-upload/` (copy-paste portable to other projects, see its own README) — with no import of anything Birava-specific; `lib/photoUpload.ts` is the **composition root** that wires it up for check-ins.

- **`PhotoUploadService`** (constructor-injected with an `IStorageAdapter`, an `IImageProcessor`, and an optional `IDirectUploadCoordinator`) is the orchestrator. Every upload runs through `SharpImageProcessor`: HEIC → JPEG normalize, auto-rotate from EXIF, strip metadata (EXIF can carry GPS), cap the long edge at 1600px, re-encode WebP, and derive a tiny base64 LQIP blur placeholder (`DrinkEntry.photoLqip`) from the same decode via `sharp().clone()`.
- **Two upload paths, picked by environment** (`lib/photoUpload.ts`'s `DrinkPhotoStorageFactory`, keyed on `NODE_ENV`): local dev posts the file straight to `app/api/uploads/drink-photo/route.ts` (`LocalDiskStorageAdapter`, disk); production/staging upload directly from the browser to Vercel Blob (`VercelBlobStorageAdapter` + `VercelBlobDirectUploadCoordinator`, via the `blob-token/` + `finalize/` routes) to route around Vercel's ~4.5MB serverless request-body limit. That's two round trips by design — see the module's README for why `onUploadCompleted` webhooks don't fit here.
- The client (`components/drink/log-drink-form.tsx`, via `modules/photo-upload/client`'s `PhotoUploadPreparer.prepare`) also resizes/compresses the photo in-browser before it ever uploads, in every environment — this is on top of, not instead of, the server-side processing above; the server always re-validates/re-processes regardless of what the client sent.
- **Serving** (`/api/photos/[entryId]`) is auth-gated (checks the viewer can see the entry) and supports size variants via query params, each independently WebP-encoded on demand and cached `private, immutable, max-age=1yr` (the entry's `photoUrl` is itself the content key — an edit swaps in a new URL, no cache-busting needed): `?size=thumb` (400px, fixed — `checkin-grid.tsx` tiles) and `?w=<n>` (session-card hero photo — `n` must be one of `lib/photoSizes.ts`'s `HERO_WIDTHS`, mirrored into `next.config.ts`'s `images.deviceSizes`; anything else falls back to the full image rather than resizing to an arbitrary size). No param = full image (the lightbox).
- **The hero photo uses a custom `next/image` loader** (`lib/imageLoader.ts`, wired via `next.config.ts`'s `images.loader`/`loaderFile`), not the built-in optimizer or `unoptimized`. The built-in `/_next/image` optimizer does a *server-to-server* fetch that doesn't carry the viewer's session cookie, so it 401s against our auth-gated route — a loader file makes the *browser* fetch directly (with cookies) while still getting a real responsive `srcSet`. `checkin-grid.tsx`'s thumbnail stays `unoptimized` (one fixed size, no responsive benefit needed).
- **`scripts/backfill-photo-derivatives.ts`** reprocesses photos uploaded before this pipeline existed (`WHERE photoUrl IS NOT NULL AND photoLqip IS NULL`) via `drinkPhotoService.reprocessStored`. Runs automatically on every staging/production deploy (`vercel.json`'s build command, after `db:seed`) — idempotent (a backfilled row drops out of the query on its own), bounded to 25 rows/run so a large backlog drains over several deploys, and never fails the build over a bad row (logs and continues, always exits 0).

## Demo seed (`prisma/seed.ts`)

A committed, idempotent seed builds the **Demobeer** showcase account (email `jairo12.jn@gmail.com`, password `Test123!`) with a full demo dataset (multi-venue photo session, lone check-in, all 4 drink types, a Local Legend venue, an active-weeks streak, a 3-member crew, followed users). Images live in `prisma/seed-assets/` and are uploaded raw via `drinkPhotoService.store()` — deliberately skipping resize/WebP/LQIP, since `scripts/backfill-photo-derivatives.ts` runs immediately after seeding on every staging deploy and picks up exactly these rows (`photoLqip IS NULL`), converging them to the standard pipeline without seed.ts needing to duplicate that logic — so they land in Vercel Blob on staging and on local disk in dev.

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
- **Uploads write to `public/uploads/` on the local filesystem** (`modules/photo-upload/adapters/LocalDiskStorageAdapter.ts`, wired in `lib/photoUpload.ts`) — this breaks on Vercel's ephemeral/read-only FS; used in dev only, `VercelBlobStorageAdapter` handles staging/production. Size (20MB cap) and format validation (via `sharp` failing to decode) live in `SharpImageProcessor` — see "Image pipeline" above.
- **Decided (2026-07-17, #108):** the active-weeks **streak grace rule is signed off as-is** — one rest week survives, two-or-more consecutive rest weeks end the run (`activeWeeks()` in `lib/sessions.ts`, locked by `lib/sessions.test.ts`). Keep it unless a future product call changes it.
- **Open product calls** (flagged 2026-07-09, don't silently decide): Countries/Passport badges omitted for lack of country data ("Types tried" substituted — tracked in #109); comments are a "soon" toast stub (proost is real).
- Dev DB contains seeded demo users (`designtest`/`sarah_pours`/`niels_hop`, pw `designtest123`, plus `audit_user`) — Jairo's real account is `SlayerofBeers`; never modify it.

## Maps without a library
`components/beer/session-map.tsx` renders a static route map as **server-side SVG** — hand-computed Web Mercator tile math with dark CARTO tiles as `<image>`, no map library and no API key. Geolocation needs HTTPS (fine on Vercel).
