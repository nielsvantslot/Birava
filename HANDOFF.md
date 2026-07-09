# HANDOFF

## [2026-07-09] — Demo seed for staging (Demobeer account + full showcase data)

**Branch:** `feature/frontend-redesign`

**Goal**
Add a committed, idempotent seed that auto-populates a **Demobeer** demo account on staging (credentials: `Demobeer` / `Test123!` / `jairo12.jn@gmail.com`) with enough data to show off every screen, including the three real beer photos.

**Current state** (all uncommitted, `tsc`+eslint clean, seed verified end-to-end on a throwaway DB)
- `prisma/seed.ts` — NEW: idempotent seed. Creates Demobeer + 18 check-ins (a 5-check-in / 3-venue evening session with route coords + the 3 photos, a lone check-in, all 4 drink types, notes, a Local Legend venue at The Local Taphouse, ~9 venues, sessions spread over 11 weeks for the active-weeks streak + chart) + 2 followed crew-mates (`sanne_b`, `niels_v` on `@demo.birava` emails) + a shared crew "Amsterdam Beer Club" (code `AMS2026`) with since-joined leaderboard data. Photos go through `saveBeerPhoto` (Blob on staging, disk in dev).
- `prisma/seed-assets/{grass-bottle,pint-table,party-cup}.jpg` — NEW: committed, resized demo photos (136–213 KB).
- `package.json` — added `db:seed` script (`tsx prisma/seed.ts`), `prisma.seed` config, and `tsx` devDep.
- `vercel.json` — build command now `prisma:generate && db:migrate && db:seed && build` (generate added so the client exists for the seed step).
- `.gitignore` — `/public/uploads/` (local upload storage) ignored.
- Also this session: merged `dev` (blob storage pipeline) — see the merge commit; and wired the 3 real photos into the existing `designtest`/`sarah_pours` demo entries in the local dev DB.

**What worked**
- Verified on a throwaway DB (`birava_seedtest`, migrated + seeded inside the container, then dropped): 18/9/4/4 (check-ins/venues/types/photos) for Demobeer, 3-member crew, seed runs with no errors.
- All three guards proven: idempotent re-run skips ("already seeded"); running against the dev DB skips because the email belongs to `SlayerofBeers` (won't clobber); default run (no flag, not preview) skips.
- Photos upload through the same storage abstraction the app serves from, so `/api/photos/[entryId]` works in both environments.

**What didn't work (and why)**
- Can't preview Demobeer on the **local** dev DB: the demo email is already `SlayerofBeers`' email (unique constraint), and the seed deliberately refuses to overwrite it. To click around as Demobeer locally, seed a fresh DB (as the throwaway test did) or temporarily free the email.

**Open questions / decisions needed**
- Staging must be a Vercel **preview** deploy (`VERCEL_ENV=preview`) for the auto-seed to fire — confirm the `staging` branch deploys as preview, not as a second production env. If not, set `SEED_DEMO=true` on that Vercel environment.
- Staging needs `BLOB_READ_WRITE_TOKEN` + the staging `DATABASE_URL` available **at build time** (the seed runs in the build command, like migrations already do).
- Demo password `Test123!` is committed in `prisma/seed.ts` — intended (it's a throwaway demo login), just be aware it's public in the repo.

**Next steps**
1. Review the diff and commit (seed + assets + package/vercel/gitignore). The `dev` merge is already committed (`2689df3`).
2. Merge to `staging`; confirm the preview build logs show `[seed] Done — Demobeer …` and that photos render (they need `BLOB_READ_WRITE_TOKEN`).
3. If the auto-seed doesn't fire, set `SEED_DEMO=true` on the staging Vercel environment.

## [2026-07-09] — Birava 2.0: session-as-hero rebuild from the "Birava 2.0" design handoff

**Branch:** `feature/frontend-redesign`

**Goal**
Implement the **Birava 2.0** redesign end-to-end from the claude.ai/design project (projectId `06857175-73ac-46ce-be13-5ee167fd3c77`, `Birava 2.0.dc.html` + 8 screen mocks + updated `birava.css`, pulled via DesignSync). Core thesis: **the session is the hero unit** — check-ins (4h-gap auto-grouped) → sessions → quiet active-weeks streak; discovery journal, not volume tracker; all-round drinks app ("drink", not "beer"). Product calls made by Jairo this session: **(a) ratings stripped app-wide** (column kept, unused), **(b) legacy pages folded — /history & top-level /leaderboard removed, /people kept off-nav** (reachable via header dropdown).

**Current state**
All uncommitted on `feature/frontend-redesign` (~70 changed paths, on top of the earlier uncommitted redesign work). `tsc --noEmit` clean; eslint has only the 2 pre-existing `input.tsx`/`textarea.tsx` errors; every screen verified live in Chrome as `designtest` (see What worked).

Core / data:
- `lib/sessions.ts` — REWRITTEN: `groupIntoSessions` now splits per user on **>4h inactivity gap** (locked rule; was per-calendar-day), `DrinkSession` (id = first check-in id → `/sessions/[id]`), `sessionTitle` (lone check-in titled by drink; else Morning/Afternoon/Evening/Late session in user TZ), `findSessionWithCheckin`, `activeWeeks` (current/best/12-week strip; one rest week survives, 2+ consecutive end the run — my interpretation of the spec's ambiguity, flagged below), `getLocalLegendVenue` kept
- `lib/dates.ts` — NEW: all TZ-aware day/week math (`localParts`, `dayNumber`, `weekIndex` Monday-based, `relativeDay(Time)`, `formatTime`, `timeAgo`) — consolidates the 4 divergent streak/day implementations the audit flagged
- `lib/timezone.ts` + `components/timezone-sync.tsx` — NEW: browser TZ → `birava_tz` cookie (client sets + refreshes once), server reads it so SSR renders in the *user's* TZ (fixes the audit's server-TZ bug; first-ever request falls back to UTC)
- `prisma/schema.prisma` + migrations `20260709120000_add_drink_type` (`BeerEntry.drinkType` default 'Beer') and `20260709121000_add_proost` (`Proost` table keyed `[entryId, userId]`, entryId = session anchor check-in) — **both applied**, client regenerated in container
- `lib/actions/beer.ts` — `addBeer/editBeer/deleteBeer` → `logCheckin/updateCheckin/deleteCheckin` (drink_name/drink_type/venue/coords/photo; no rating/style/amount); update cleans replaced photo files; achievement-unlock diff via `earnedIds` before/after
- `lib/achievements.ts` — REWRITTEN: variety badges only (First Round, Range, Cartographer, Local Legend, Chronicler, Regular) with progress/goal/progressText; count-based ACHIEVEMENTS deleted; confetti recolored to brand
- `lib/crews.ts` — NEW: `getCrewBoard` — **since-joined scoring** (entries before a member's joinedAt never count), sessions + venues metrics, recent crew sessions
- `lib/proost.ts` (read helper) + `toggleProost` server action in `lib/actions/social.ts`; `getSocialFeed/getPublicProfile/getPublicRecentEntries/toFeedEntry` + dead types (`FeedEntry`, `PublicProfile`, `Achievement`, `LeaderboardEntry`, `Group`, `GroupMember`) deleted
- `lib/types.ts` — slimmed; added `DRINK_TYPES = ["Beer","Wine","Cocktail","Other"]`, `BeerEntry.drink_type`

Screens / shell:
- `components/layout/bottom-nav.tsx` + `app/globals.css` — **5 tabs** (Home·Stats·Log·Crews·You), Feed removed; globals.css gained the full 2.0 grammar from `birava.css` (act-title-link, checkin-line, expander, venue-head/splits, gallery, hint, social.acts, card-photo, routechip, weeks strip, barrow, ach-grid, lb, event, members, metric-seg); star-rating CSS removed
- `components/layout/app-header.tsx` — detail routes (`/sessions/*`, `/crews/[id]`, `/achievements`, `/people`, `/profile/[username]`) get a back arrow; dropdown gained Achievements link
- `app/(app)/dashboard/page.tsx` + `components/beer/session-card.tsx` (NEW) — merged feed: session cards sized to content (multi-venue: Check-ins/Venues/Out for + routechip; single-venue: Venue/Type; lone check-in: slim card + note), photo hero, one-time explainer hint after first card, Local Legend callout on newest own session only; `checkin-expander.tsx`, `minimap.tsx` (abstract 60×44 route thumb), `social-row.tsx` → `SocialActs` (real proost w/ optimistic live count, comment "soon" toast, share; icons, no emoji)
- `app/(app)/sessions/[id]/` — NEW session detail: computed by re-grouping ±48h around the anchor check-in; stats big row, tile map with **numbered venue pins** (honey pin = Local Legend venue) via extended `session-map.tsx`, venue-grouped splits (owner rows link to `/log?edit=<id>`), photo gallery, social row
- `app/(app)/log/` + `log-beer-form.tsx` → `CheckinForm` — ONE form for create + edit (`/log?edit=<id>`): Drink, Type seg, optional 190px photo, Venue w/ silent geolocation; edit adds Delete; success toast "Logged — added to tonight's session", **no streak anywhere near logging**; Recent rows open edit
- `app/(app)/stats/page.tsx` — All time (Sessions/Venues/Drinks tried), active-weeks streak + dashed rest strip + legend, sessions-per-week SVG chart, "What you explore" type bars + Types/Notes/Local Legend, achievements teaser; empty state = "Stats appear after your first session."
- `app/(app)/crews/` — list (member count + "you're Nth since you joined" + code chip) + create/join; join error is exactly **"That code doesn't match any crew."**; `crews/[id]/` NEW detail: identity + LIVE event banner w/ member stack + "since <date>", `crew-leaderboard.tsx` client metric toggle (Sessions/Venues, re-ranks), latest-in-crew rows → session details; `/leaderboard`(+`[groupId]`) and `/groups` now redirect to `/crews(/<id>)`
- `app/(app)/profile/page.tsx` + `profile-client.tsx` (split into `ProfileHead`/`ProfileActions`) — variety stats (Sessions/Venues/**Types tried**/Active wks), achievements rows, recent sessions; `profile/[username]/page.tsx` REWRITTEN in token grammar (was card-soup with Total 🍺/streak/avg-day — all gone; computes over ALL entries, fixing the take-20 bug)
- `app/(app)/achievements/page.tsx` — NEW: streak section + "A rest week won't break it" callout + Discovery ach-grid
- `app/(app)/people/` + `people-client.tsx` — restyled to token grammar, no emoji; deleted: history/, feed/, beer-card, add-beer-dialog, feed-photo-download, stats-share, leaderboard-client, board-groups-client, group-*-client/gallery/feed, groups-client, stat-card, lib/leaderboard.ts
- `app/layout.tsx` + `public/manifest.json` — metadata/manifest rebranded (no emoji, theme_color `#f97316`→`#0A0D09`); auth pages: emoji + orange shadow stripped

Test data: designtest gained 1 Wine ("Barolo 2018" · Da Vinci, logged live) and 1 proost (from designtest on own session) — purge with the rest of the seeded data if desired.

**What worked**
- Verified live at mobile width as `designtest`: merged feed (slim/medium/full cards, hint, TZ-correct "Yesterday, 14:10"), session detail (numbered pins, honey legend pin, venue splits), log flow end-to-end (Wine → toast → Recent → stats bars update), stats, crews + crew detail (**since-joined scoring confirmed: shows 3 sessions, not the 16 lifetime**), wrong-code error, You, public profile, achievements, proost toggle (persisted, count survives reload), `/leaderboard`→`/crews` 307, `/history` & `/feed` 404
- Sessions being **computed, never stored** (anchor = first check-in id) meant zero migration of existing data and the detail page stays correct as new check-ins extend a night
- The TZ cookie (`birava_tz`) gives TZ-correct SSR with no hydration mismatch — one `router.refresh()` on first visit
- Proost keyed by anchor check-in id made a real kudos backend a 20-line table + one action

**What didn't work (and why)**
- **Turbopack truncated-read struck ~15 files at once** after the bulk edits ("Expected '</', got '<eof>'" for files that are fine on disk). Per-file `touch` was whack-a-mole; **`docker restart birava-app` flushed all of them in one go** — prefer that after any multi-file editing burst
- First login attempt via coordinate clicks triggered a password-manager extension popup that stole the MCP focus ("Cannot access a chrome-extension:// URL"); recovering = re-`navigate` the tab, then use `read_page` refs + `form_input` instead of click-and-type
- `next dev` compiles routes lazily — first hit on a brand-new route (`/crews/[id]`) can bounce back to the referrer while "Compiling…"; just retry the click

**Open questions / decisions needed**
- **Active-weeks streak semantics**: spec says a rest week doesn't break the streak but "Best = longest run" implies runs end. Implemented: one rest week = grace (run survives), 2+ consecutive rest weeks end it; only active weeks count toward the number. Confirm with Niels or adjust `activeWeeks()` in `lib/sessions.ts`
- **Countries/Passport/Globetrotter**: mockups show Countries stats + Passport/Globetrotter badges, but there's no country data (only lat/lng). I substituted "Types tried" on You/stats and omitted both badges rather than fake them. Options: reverse-geocode country at log time (nominatim already used for venue) and add a `country` column, or drop permanently
- **Comments**: mock shows counts; no thread UI was designed → left as "Comments — soon" toast (proost is real)
- Dropped 1.0 leftovers now fully orphaned: recharts/`@radix-ui/react-progress`/`-separator`/`-toast` deps (already unused per tech audit) — `npm uninstall` when convenient
- The dev overlay flags "uncached data outside Suspense" on routes (pre-existing `cacheComponents: true` issue = tech-audit 🔴-1; `next build` still fails on prerender). Fix before CI/deploy
- Purge seeded demo data before merge? (designtest/sarah_pours/niels_hop entries + audit_user + `public/uploads/beer-photos/*`)

**Next steps**
1. Read the diff and commit in slices (suggested: schema+lib core / shell+css / screens / legacy folds)
2. Get Niels/Jairo sign-off on the streak-grace rule and the Countries substitution (both flagged above)
3. Fix the pre-existing ship-blockers before deploy: forgot-password `resetUrl` leak, upload validation/storage, `cacheComponents` Suspense build failure (see the two 2026-07-09 audit entries below — still open)
4. Optional polish: real comments backend, morning-after "name your session" recap (spec §7 nicety), `npm uninstall recharts @radix-ui/react-progress @radix-ui/react-separator @radix-ui/react-toast`
5. If any screen acts stale in a browser: it's the service worker or Turbopack cache — unregister SW / `docker restart birava-app`

## Previous Session

## [2026-07-09] — Full product & UX audit of the redesign working tree

**Branch:** `feature/frontend-redesign`

**Goal**
Audit-only session (no product code changed). Jairo asked for a full product/UX audit of Birava against the intended concept (deadpan-athletic Strava-for-beer, token-based design system, session/streak/crew mechanics): concept coherence, vocabulary drift, five user journeys, IA/nav, token consistency, PWA/mobile reality, and the "uncomfortable questions" about streaks incentivizing drinking. Deliverable: a written report in the repo, per an explicit output-format brief. Complementary to the same-day **technical** audit below (security/perf) — this one is product/UX; the two overlap only on forgot-password and uploads, and agree there.

**Current state**
- `docs/audit/birava-audit-2026-07-09.md` — NEW: the full report (header w/ commit + method, Step-0 concept reconstruction w/ mismatch table, findings grouped 🔴/🟡/🔵 with file:line refs and concrete fixes, Step-6 answers on streak/volume/retention hazards, ranked five-things-first list, what's-working list). Also copied to `~/Documents/birava-audit-2026-07-09.md` on request.
- `HANDOFF.md` — this entry.
- **No app/lib/component files touched.** Audited state = commit `b57377a` + the uncommitted redesign tree (unchanged by this session).
- Dev-environment side effects only: wiped the corrupted `birava_birava-next-cache` Docker volume to get the app booting (container recreated, app runs fine); logged 1 test beer as `designtest` (today, IPA/★4/×1, no venue); created throwaway account `audit_user` / `audit@test.local` / `auditpass123`. Purge alongside the other seeded demo data if desired.

**What worked**
- Ran the app live via the existing `docker compose` setup and clicked through every screen twice (seeded `designtest` for filled states, fresh `audit_user` for empty states) at mobile width via Chrome MCP — several top findings (History hydration crash, streak contradictions, UTC session titles, "Group not found" inside Crews) were only visible live, not from the static read.
- The HANDOFF-documented cache fix resolved the `TurbopackInternalError` / "Internal Server Error" the app booted into — but see What didn't work for the exact command order.
- Reading the whole codebase first meant the live pass could target journeys (wrong invite code, one-tap log, empty states) instead of wandering.

**What didn't work (and why)**
- `docker volume rm` fails with "volume is in use" even when the container is *stopped* — must `docker rm birava-app` first, then `docker volume rm birava_birava-next-cache`, then `docker compose up -d app`.
- Dev server intermittently restarted claiming "Found a change in next.config.ts" mid-audit; navigations during the restart window return an error page. (Explanation surfaced later: the parallel tech-audit session was toggling `next.config.ts` for its build measurement at the same time. Retry, don't debug.)
- Screenshots immediately after `navigate` in a browser batch can hit the error page; wait 2–3 s after navigation.

**Key audit results (headlines — read the report)**
- 🔴 Two apps stitched together: 6 redesigned screens vs 5 legacy screens (`/history`, `/leaderboard`(+`[id]`), `/people`, `/profile/[username]`); Crews and Board are the same feature twice; the join-error inside Crews says "Group not found".
- 🔴 `/history` broken for non-UTC users: `formatDate` server/client TZ mismatch → hydration error → framer-motion cards stuck invisible (confirmed live, entries render blank).
- 🔴 All day-math (sessions, streaks, "today") runs in server TZ; live: a 10:19 CEST log renders "08:19 · Morning Session".
- 🔴 Streak logic: 4 divergent implementations + `getPublicProfile` hardcodes 0; live showed 0d / 6d / "Streak: 1 days" for the same user within a minute.
- 🔴 Crew leaderboards rank **lifetime** totals (`beer_entries.group_id` is never written) — joining a crew with history auto-wins it. Suggested fix: count since `joined_at`.
- 🔴 Public profile "Total" sums only the last 20 entries (`take: 20` in `profile/[username]/page.tsx`).
- 🔴 Ship-blockers shared with the tech audit: forgot-password returns `resetUrl` to any caller; uploads on local FS with no validation.
- 🟡 Proost/Comment/··· are non-persisting stubs; offline logging just fails (bar app); manifest still orange `#f97316`; streaks = consecutive drinking days (app-store/brand hazard — report proposes weeks-active + rest-day framing, volume→variety achievements, dropping "Avg/day" from public profiles).

**Open questions / decisions needed**
- Which findings land in this branch vs after merge? (Recommended in-branch: streak/TZ consolidation, History hydration fix, forgot-password guard — regressions/hazards in code this branch ships.)
- Product calls for Jairo/Niels: merge Home+Feed into one social tab? Streak unit days → active weeks? Make Proost real (small Kudos table) or remove it? Crew scoring window (since `joined_at` vs explicit trip dates)?
- Purge `audit_user` + the extra `designtest` beer along with the seeded demo data before merge?

**Next steps**
1. Read `docs/audit/birava-audit-2026-07-09.md`; triage the 🔴 list with Niels (five-things-first list is near the bottom; the tech audit's top-five overlaps deliberately on the two ship-blockers).
2. Fix before any deploy regardless of triage: gate `resetUrl` in `app/api/auth/forgot-password/route.ts`; validate + relocate photo uploads (`lib/storage/local.ts`).
3. Consolidate streak math into one TZ-aware `lib/` function (currently in `log/page.tsx`, `profile/page.tsx`, `profile/[username]/page.tsx`, `stats/page.tsx`, `lib/actions/social.ts`).
4. Fix `/history` hydration (client-side date formatting in `beer-card.tsx`; drop server-rendered `initial={{opacity:0}}`).
5. Run the vocabulary table in the report through the codebase ("Group"→"crew" in `lib/actions/groups.ts` errors, `board-groups-client.tsx`, `group-leaderboard-client.tsx`).

## Previous Session

## [2026-07-09] — Pre-launch technical audit (security / performance / image pipeline / code quality)

**Branch:** `feature/frontend-redesign`

**Goal**
Produce a blunt, pre-launch technical review of Birava — security (auth, injection, invite codes, uploads, secrets, headers), performance/bundle, the photo image pipeline, and code-quality/maintainability. Deliverable was a written report, not code changes. This was a **read-only audit session**; no production behavior was intentionally changed.

**Current state**
- `docs/audit/birava-tech-audit-2026-07-09.md` — NEW: the full report (findings by severity, image-pipeline gap list, top-five actions, "what's solid"). Header records commit `b57377a`, measured baseline, and method.
- Copied to `~/Documents/birava-tech-audit-2026-07-09.md` at the user's request (outside the repo).
- **No source files changed.** During the audit I temporarily set `cacheComponents: false` in `next.config.ts` and wrapped `useSearchParams` in `<Suspense>` in `app/(auth)/reset-password/page.tsx` **only to get the production build to complete for bundle measurement** — both were reverted and `git diff` on those two files is empty. Confirmed clean.
- `npm install` + `npx prisma generate` were run (node_modules was empty at session start — the build failed on missing `@prisma/client`/`bcryptjs` until then). This only populates `node_modules/`; nothing tracked changed.

**Measured baseline (from a clean local build)**
- Client JS **322 KB gzipped** (1071 KB raw); largest chunk 69 KB gz. CSS 9.4 KB gz.
- `npm audit`: 5 vulns (3 high `effect` via prisma, 2 moderate `postcss` via next) — all transitive.
- `recharts` is installed but imported nowhere (dead dep); `@radix-ui/react-progress`/`-separator`/`-toast` unused; `framer-motion` used only for one fade in `beer-card.tsx`.
- Lighthouse **not run** — see below.

**What worked**
- Full static read of every route/action/lib + Prisma schema + SW + config gave a complete picture without a live backend.
- Measured the bundle by building to `.next/static/chunks` and gzip-summing, since Next 16 + Turbopack build output doesn't print per-route sizes.

**What didn't work (and why)**
- **The production build does not complete with the committed config.** `cacheComponents: true` (`next.config.ts:6`) requires `useSearchParams`/`usePathname` to sit inside `<Suspense>`; `app/(auth)/reset-password/page.tsx:13` and `components/layout/bottom-nav.tsx:75` don't, so `next build` errors out on prerender. This is why Lighthouse couldn't be run (couldn't serve a prod build) and is logged as finding 🔴-1 in the report.
- First build attempt failed on missing deps — `node_modules` had no `@prisma/client`/`bcryptjs` and no generated Prisma client. Fixed with `npm install` + `npx prisma generate` (host-side worked fine here for install/generate; note prior sessions warn host `npx prisma` can pull Prisma 7 — generate succeeded on the pinned 6.16.2 this time).

**Open questions / decisions needed** (these are for the human — the audit only surfaces them)
- Top-two ship blockers to fix first: 🔴-2 forgot-password returns the reset token in the HTTP response (account takeover), and 🔴-1 the build is broken. Both are fast fixes.
- 🔴-4: uploads write to `public/uploads` on the local FS — this cannot work on Vercel's read-only/ephemeral FS, so the photo feature is effectively broken in production until storage moves to Blob/S3/R2. Confirms the earlier session's untracked `public/uploads/beer-photos/` is dev-only.
- Full ranked action list is in the report's "Top five actions" section.

**Next steps**
1. Read `docs/audit/birava-tech-audit-2026-07-09.md` and triage the 🔴 findings (6 of them).
2. Fix 🔴-2 first (`app/api/auth/forgot-password/route.ts:34-38` — stop returning `resetUrl`), then 🔴-1 (Suspense-wrap the two hooks, add `next build` to CI).
3. Address the upload trio together (🔴-3/🔴-4): magic-byte + size validation, `sharp` re-encode to strip EXIF/fix orientation, and move storage off the app filesystem.
4. Add rate limiting (🔴-5) and security headers (🔴-6); regenerate invite codes with `crypto` (🟡-7).
5. The audit is advisory only — no fixes have been applied. Decide which to implement before the redesign branch merges to `main`.

## Previous Session

## [2026-07-09] — Frontend redesign from Claude Design + rating/venue/GPS/photos features

**Branch:** `feature/frontend-redesign`

**Goal**
Implement Jairo's claude.ai/design project ("HTML to Claude Design", projectId `06857175-73ac-46ce-be13-5ee167fd3c77`, entry file `Overview.dc.html`) across the whole app: new dark theme, new fonts, six redesigned screens, plus the design's "slightly new features" (beer rating, venue). Follow-up requests in the same session added GPS/route maps and made photos first-class in the feed/session cards.

**Current state**
All work is **uncommitted** on `feature/frontend-redesign` (36 changed/new paths). Verified end-to-end in the browser (see What worked). Nothing broken.

Theme / shell:
- `app/globals.css` — full rewrite: Birava design tokens (bg `#0A0D09`, surface `#111510`, accent `#A9C641`, honey `#E8C15A`) + component grammar ported ~verbatim from the design project's `birava.css`; legacy vars (`--primary`, `--card`, …) remapped so untouched pages (auth, history, leaderboard, people) inherit the theme
- `app/layout.tsx` — Archivo (wdth axis) + Source Serif 4 via next/font; themeColor `#0A0D09`
- `app/(app)/layout.tsx` — new shell: AppHeader + max-w-lg column + BottomNav + ToastPill; AddBeerFab removed
- `components/layout/app-header.tsx` — NEW: avatar→/profile, route-derived title, +→/log, settings dropdown w/ sign out
- `components/layout/bottom-nav.tsx` — 6 tabs (Home/Feed/Stats/Log/Crews/You) with design SVG icons; `.navwrap` wrapper keeps the grid centered at max-w-lg
- `components/ui/toast-pill.tsx`, `components/ui/screen-tabs.tsx` — NEW: design pill toast (window CustomEvent) + tab strip (href or "soon"-toast per tab)
- Deleted: `top-bar.tsx`, `add-beer-fab.tsx`, `stats-charts.tsx`, `last-24h-recap.tsx` (orphaned by redesign; recharts + 24h-recap/share-image features dropped with them)

Screens:
- `app/(app)/dashboard/page.tsx` — Home: Strava-style session cards (own + followed users' entries grouped per user per day via NEW `lib/sessions.ts`), Local Legend callout (top venue ≥3 check-ins/90d), photo mosaic (`SessionPhotos`: 1=full-bleed, odd=full-width lead, >4=+N overlay), route map, ?tab=you filter
- `app/(app)/feed/page.tsx` — design cards (accent @user, ×N/style/★ chips, venue·date meta, big rounded photos); **feed now includes own entries** (`getSocialFeed` prepends user.id)
- `app/(app)/stats/page.tsx` — this-week flat stats, 12-week SVG line chart (no recharts), month streak calendar, clipboard Share recap (`components/beer/stats-share.tsx`)
- `app/(app)/log/` — NEW page + `components/beer/log-beer-form.tsx`: name, "Snap your beer" photo area (moved up, camera-first), style chips, 5-star rating w/ captions, venue + "Use my location", ×1-4 amount, Recent list; `loading.tsx` present
- `app/(app)/crews/` — NEW page + `components/beer/crews-forms.tsx`: crew rows (member count, live rank from beer totals, code chip → /leaderboard/[id]), create/join forms; `/groups` now redirects here; `loading.tsx` present
- `components/beer/profile-client.tsx` — You screen rewrite (kept username edit + sign out; added crews stat, honey achievement rows, Settings toast)
- `components/beer/social-row.tsx` — Proost/Comment are toast stubs (no backend), Share uses navigator.share/clipboard

Backend / data:
- `prisma/schema.prisma` + migrations `20260708160000_add_rating_venue`, `20260709100000_add_entry_coordinates` — BeerEntry gained `rating Int?`, `venue String?`, `lat/lng Decimal(9,6)?`. **Both migrations applied** to the dev DB; prisma client regenerated in container
- `lib/types.ts`, `lib/mappers.ts`, `lib/actions/beer.ts` — new fields threaded through (mappers convert Decimal→number); `add-beer-dialog.tsx` (still used for editing in /history) passes them through
- `lib/actions/groups.ts` — createGroup returns `inviteCode`, joinGroupByInvite returns `groupName` (for toasts)
- `components/beer/session-map.tsx` — NEW: dependency-free static route map (server-rendered SVG; Web Mercator tile math; dark CARTO tiles as `<image>`; accent route path; zoom auto-fit; attribution). No map library, no API key
- `components/service-worker-registration.tsx` — SW now production-only; in dev it unregisters + clears caches (see What didn't work — this was the stale-chunk root cause)

Test data (dev DB, safe to purge): users `designtest` / `sarah_pours` / `niels_hop` (password `designtest123`), entries with ratings/venues/coords (Amsterdam), crew "Oktoberfest 2026" (code OKT26A), 4 generated placeholder photos under `public/uploads/beer-photos/` (untracked). Jairo's real account (SlayerofBeers) untouched.

**What worked**
- DesignSync MCP (`/design-login` first) to pull all `.dc.html` screens + `birava.css`; porting the design CSS as-is into globals.css and keeping legacy var names mapped meant untouched pages themed themselves for free
- Verified in Chrome as `designtest`: all 6 screens visually match the design; logged a beer end-to-end (rating/venue/amount land in Postgres); route map renders a 3-venue Amsterdam route; photo mosaics + feed photos render; `docker exec birava-app npx tsc --noEmit` clean; eslint has only 2 pre-existing errors (`ui/input.tsx`, `ui/textarea.tsx` empty-interface)
- Static SVG map (tiles computed by hand) instead of leaflet/maplibre: no deps, SSR-safe, scales like the design's fake map

**What didn't work (and why)**
- **Root cause of Niels's old "missing expected function export" mystery found:** `public/sw.js` serves `/_next/static` cache-first, and dev chunk URLs are NOT content-hashed → a registered service worker keeps serving stale JS through hard reloads, container restarts, even `.next` wipes. Fixed in `service-worker-registration.tsx` (prod-only + dev cleanup). If a browser still acts stale: DevTools → Application → Service Workers → Unregister, clear storage
- **Turbopack + macOS bind mount partial reads:** twice during rapid multi-file edits the dev server compiled a *truncated* file ("Expected '</', got '<eof>'") and cached it. The file on disk was fine. Fix: `touch <file>` (or restart container). Don't debug the "syntax error" — it isn't one
- **Prisma client regenerate ≠ live:** after `prisma generate` in the container, the running dev-server process still has the old client in memory — new columns come back `undefined` (which cascaded to `Number(undefined)=NaN` in the map math). Always `docker restart birava-app` after generate; `tsc` passing proves nothing about the running process
- Heredocs into psql need `docker exec -i` (without `-i` the SQL is silently not executed)

**Open questions / decisions needed**
- Dropped features from the old stats page (recharts style/brewery breakdowns, last-24h recap + share-image) — re-add inside the new design language, or gone for good?
- Feed photo-download button no longer rendered (`feed-photo-download.tsx` now orphaned) — delete or reinstate?
- Coordinates are visible to followers via the Home route map (Strava model) — fine, or add a "hide my map" privacy toggle?
- Social row Proost/Comment are visual stubs — build a real proost (like) backend next?
- Purge the seeded test users/photos before merging, or keep for demos? (`DELETE FROM "User" WHERE email LIKE '%@example.test'` cascades; rm `public/uploads/beer-photos/<designtest-id>` dirs)

**Next steps**
1. Review the diff and commit on `feature/frontend-redesign` (nothing staged; suggested split: theme+shell / screens / schema+features / SW fix)
2. Tell Niels about the service-worker fix (`components/service-worker-registration.tsx`) — it likely explains his historic stale-chunk pain; he should unregister the SW once in his browser
3. Decide the Open questions above (esp. purging test data before merge/PR to `main`)
4. Optional polish: session recap share-image (photo collage + stats) for the Share button; real proost backend; "Nearby" tab using the new lat/lng data
5. Production check before deploy: geolocation requires HTTPS (fine on Vercel); CARTO free tiles are OK at hobby volume, swap for a keyed provider (e.g. MapTiler) if traffic grows

## Previous Session

## [2026-07-08] — Remove the fake Supabase shim; port everything to direct Prisma

**Branch:** `feature/backend-switch-jairo`

**Goal**
Finish the Supabase→Prisma migration properly. Copilot's original migration didn't remove Supabase — it hid a 566-line fake Supabase query-builder in `lib/supabase/server.ts` that translated `.from()/.rpc()` calls to Prisma (Niels's complaint: "niet alle supabase shit er uit gehaald"). This session removed the shim entirely and ported all 15 call sites to direct Prisma queries.

**Current state**
All uncommitted, nothing broken. Verified end-to-end (see What worked).

- `lib/mappers.ts` — NEW: `toBeerEntry` / `toFeedEntry` map Prisma rows to the snake_case DTO types in `lib/types.ts` that all components consume
- `lib/auth/proxy-session.ts` — NEW: session-cookie check moved here verbatim from deleted `lib/supabase/middleware.ts`; `proxy.ts` now imports it
- `lib/actions/beer.ts` — direct Prisma; dropped the "ensure profile exists" block (User row is the profile now, always exists)
- `lib/actions/groups.ts` — direct Prisma; `createGroup` uses one nested create (group + owner membership, transactional) instead of insert + rollback-rpc
- `lib/actions/social.ts` — direct Prisma; all former `rpc()` functions (feed, follow counts, public profile) ported inline
- `lib/actions/profile.ts` — `getUser` → `getCurrentUser` from `lib/auth/session`
- 10 pages in `app/(app)/` — direct Prisma; `layout.tsx` and `profile/page.tsx` no longer query "profiles" at all since `getCurrentUser()` already returns username/avatar_url/created_at
- Deleted (staged via `git rm`): `lib/supabase/` (client/middleware/server), `supabase/` (old SQL migrations + config), `middleware.ts` (replaced by `proxy.ts`, Node runtime — this is what fixes Niels's edge-runtime PrismaClientValidationError)
- `.env` and `.env.example` — just `DATABASE_URL` (host port **5433**) + `NEXT_PUBLIC_APP_URL`; removed `supabase` from `.dockerignore`

**What worked**
- `docker exec birava-app npx tsc --noEmit` — 0 errors
- After `docker restart birava-app`: all 9 authenticated pages (dashboard, history, stats, feed, people, leaderboard, leaderboard/friends, profile, profile/[username]) return 200 with a real session cookie and render seeded DB content; auth redirects both ways (307) work; no errors in container logs. Test user/session/entry created via Prisma in the container, then deleted.
- `getCurrentUser()` (React-cached, `lib/auth/session.ts`) is the one auth entry point for pages/actions; `lib/auth/proxy-session.ts` is the proxy's cheap session check.
- Repo greps clean: `grep -rin supabase` over app/components/lib/prisma/config finds nothing (except this file).

**What didn't work (and why)**
- `getUser` from the shim returned a Supabase-shaped user (`user_metadata.username`, nullable email) — call sites had fallback chains like `profile?.username ?? user.email?.split("@")[0]`. These are dead paths with `getCurrentUser()` (username/email always set); they were removed, not ported.
- Host-side `npx prisma` still downloads Prisma 7 which rejects this schema — the project pins 6.16.2; always run prisma inside the container.

**Open questions / decisions needed**
- `getPublicProfile` in `lib/actions/social.ts` still returns `streak_days: 0` (shim did the same — streak was never computed server-side). Fine or compute it?
- The proxy session check hits Postgres on every matched request (unchanged from before) — consider a JWT-style or cached check later.

**Next steps**
1. Commit everything on `feature/backend-switch-jairo` (Supabase deletions are already staged by `git rm`; the rest is unstaged). Suggested message: `remove supabase shim, port all queries to direct prisma`.
2. Push and tell Niels — this includes the `middleware.ts` → `proxy.ts` fix for his edge-runtime crash (his screenshot "atm is dit de issue to fix").
3. Optional cleanup: `docker volume rm birava-next-cache` if stale-chunk "missing expected function export" errors ever reappear after renames.

## Previous Session

## [2026-07-08] — Fix signup crash + edge-runtime crash after Supabase→Prisma switch

**Branch:** `backend-switch`

**Goal**
Get the app working again after the Supabase→Prisma/Postgres migration (commit `d965896`). This session diagnosed and fixed two bugs that made signup and all authenticated pages crash, and verified the app runs end-to-end via `docker compose`.

**Current state**
- `prisma/schema.prisma` — added missing `@map` annotations on four `User` fields (`password_hash`, `avatar_url`, `password_reset_token`, `password_reset_expires`). **Committed** by Jairo as `9bd2c62`.
- `middleware.ts` → `proxy.ts` — renamed file and exported function `middleware` → `proxy` (Next.js 16 convention; proxy runs on Node.js runtime). Logic unchanged, still calls `updateSession` from `lib/supabase/middleware.ts`. **Uncommitted** (`D middleware.ts`, untracked `proxy.ts`).
- App verified working: signup form → account creation → redirect → dashboard renders. Test accounts created during verification were deleted from the DB.
- Nothing is in a broken state.

**What worked**
- Bug 1 (signup 400, "column passwordHash does not exist"): the hand-written migration `prisma/migrations/0001_init/migration.sql` uses snake_case columns, but four `User` fields lacked `@map`. Adding the annotations fixed it — no DB change needed.
- Bug 2 (`PrismaClientValidationError: ... edge runtime` on every authenticated page): `middleware.ts` queries the DB via Prisma, and middleware runs on the edge runtime. Renaming to `proxy.ts` (deprecation replacement in this Next.js 16.2.9) moves it to the Node.js runtime where Prisma works. Confirmed in `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`.
- Regenerate the Prisma client **inside the container**: `docker exec birava-app npm run prisma:generate`, then `docker restart birava-app`. There is no local `node_modules` — everything runs in Docker.

**What didn't work (and why)**
- Running `npx prisma` on the host: no local install, so npx downloads Prisma 7, which rejects this schema (`datasource url` moved to `prisma.config.ts` in v7). The project pins Prisma 6.16.2 — always use the container's install.
- After restarting the container, a burst of "Proxy is missing expected function export name" errors appeared in the logs. These came from the stale `.next` cache volume (`birava-next-cache`) / old HMR chunks and stopped after recompile. Harmless; if they persist after future renames, wipe that volume.

**Open questions / decisions needed**
- `lib/supabase/` naming is now a lie — `lib/supabase/middleware.ts`, `client.ts`, and `server.ts` no longer talk to Supabase. Rename/reorganize? (Left untouched to keep the fixes minimal.)
- `supabase/` directory with old SQL migrations still exists at repo root — delete or keep for reference?
- The middleware/proxy session check queries Postgres on **every matched request** — fine for dev, may want caching or a JWT-style check later.

**Next steps**
1. Commit the proxy rename (uncommitted: `middleware.ts` deleted, `proxy.ts` added). Suggested message: `move session check from middleware to proxy (node runtime)`.
2. Tell Niels to pull — his container re-runs `prisma generate` on startup, so both fixes apply automatically.
3. Consider the cleanup items under Open questions (rename `lib/supabase/`, remove stale `supabase/` migrations).
4. Per `AGENTS.md`: this Next.js 16 build has breaking changes — read `node_modules/next/dist/docs/` before writing Next-specific code. The dev server also flags other deprecations worth a look (`middleware` was one; watch startup logs).
