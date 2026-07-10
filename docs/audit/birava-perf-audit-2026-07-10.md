# Birava — performance & load-speed audit

- **Date:** 2026-07-10
- **Commit:** `9684a44` (`feature/frontend-redesign`, clean tree)
- **How measured:** production build (`next build` + `next start`, node:20-alpine container, local Postgres, ~0.2 ms DB round-trip). Server times via `curl` with an authenticated session; per-route DB query counts via Postgres `log_statement=all`; client behavior in real Chrome against the prod server; Lighthouse 12 mobile profile (emulated Moto-class device, slow-4G, 4× CPU throttle) through a cookie-injecting proxy for authenticated pages. Scaling checked with a throwaway 2 000-check-in account (created and deleted during the audit).
- **Good news first:** `next build` **passes** — the CLAUDE.md "build currently fails on prerender" landmine is stale. All app routes compile as Partial Prerender (◐). Add the build to CI now.

---

## Implementation brief (read this first if you're starting cold)

This section is the operational handoff: how to run the app, reproduce every number in this report, and verify a fix worked. Read `CLAUDE.md` + `AGENTS.md` first — they hold the hard product/architecture invariants; this only adds the perf-specific workflow. **Everything runs in Docker; there is no host `node_modules`.**

**Environment state as of this report:** dev containers (`birava-app` on :3000, `birava-postgres`) are up; the throwaway prod container and 2 000-row test account were removed and Postgres `log_statement` was reset to `none`. You start from a clean dev stack.

**Test accounts** (dev DB only — never touch `SlayerofBeers`, that's the owner's real account):
- Login is **by email, not username** (`/api/auth/login` 401s on a username — this cost time during the audit). Use `designtest@example.test` / `designtest123` (17 check-ins, 1 crew: "Oktoberfest 2026"). Other seeded users: `sarah_pours@example.test`, `niels_hop@example.test`, same password.
- Pages also need a `birava_tz` cookie or the first render double-fires (F8). Set `birava_tz=Europe/Amsterdam` alongside the session cookie.

**Reproduce the measurements** (all commands assume the compose network `birava_default` and the named volume `birava_birava-node-modules`):

```bash
# 1. Production build + server (dev :3000 is in use, so run prod on :3001 in a one-off container)
docker run --rm --network birava_default -v /Users/jaironiks/Projects/Birava:/app \
  -v birava_birava-node-modules:/app/node_modules -w /app \
  -e DATABASE_URL='postgresql://birava:birava@db:5432/birava?schema=public' \
  -e NEXT_PUBLIC_APP_URL='http://localhost:3001' node:20-alpine npm run build
docker run -d --name birava-prod --network birava_default -p 3001:3000 \
  -v /Users/jaironiks/Projects/Birava:/app -v birava_birava-node-modules:/app/node_modules -w /app \
  -e NODE_ENV=production -e DATABASE_URL='postgresql://birava:birava@db:5432/birava?schema=public' \
  -e NEXT_PUBLIC_APP_URL='http://localhost:3001' node:20-alpine npm run start -- --hostname 0.0.0.0 --port 3000

# 2. Authenticate (writes cookies.txt; then append the TZ cookie)
curl -s -c cookies.txt -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' -d '{"email":"designtest@example.test","password":"designtest123"}'
printf 'localhost\tFALSE\t/\tFALSE\t0\tbirava_tz\tEurope/Amsterdam\n' >> cookies.txt

# 3. Server render time per route
curl -s -b cookies.txt -o /dev/null -w '%{time_starttransfer}s ttfb / %{time_total}s total\n' http://localhost:3001/dashboard

# 4. DB queries per route (before/after diff of the statement log)
docker exec -i birava-postgres psql -U birava -d birava -c "ALTER SYSTEM SET log_statement='all';"
docker exec -i birava-postgres psql -U birava -d birava -c "SELECT pg_reload_conf();"
b=$(docker logs birava-postgres 2>&1 | grep -c 'LOG:  execute'); curl -s -b cookies.txt -o /dev/null http://localhost:3001/dashboard; sleep 0.6
echo "queries: $(( $(docker logs birava-postgres 2>&1 | grep -c 'LOG:  execute') - b ))"
# when done: ALTER SYSTEM RESET log_statement; SELECT pg_reload_conf();

# 5. Scaling test — insert N rows for a throwaway user, measure, then DELETE the user + rows (do NOT leave test data)
#    (see git history of this session; use gen_random_uuid(), column "userId", createdAt spread over hours)

# 6. Lighthouse mobile on an authed page — Chrome drops --extra-headers on redirect, so proxy the cookie in:
#    tiny node http proxy on :3002 that injects `Cookie: birava_session=...; birava_tz=...` and forwards to :3001,
#    then: npx lighthouse http://localhost:3002/dashboard --only-categories=performance --chrome-flags="--headless=new"
```

For in-browser checks (tab-switch refetch, prefetch counts) use the Chrome MCP tools: set the `birava_session` + `birava_tz` cookies via `javascript_tool`, then `read_network_requests` while clicking the bottom nav. The session token for a logged-in cookie jar is the last field of the `birava_session` line in `cookies.txt`.

**Suggested order (ship + verify each before the next):**
1. **F3, F4, F5** first — pure query/asset wins, no design decisions, **zero freshness trade-off**. Verify with the query-count recipe (step 4) and the scaling test (step 5): `/stats` at 2 000 rows should stop growing; `/crews` should drop from ~10 queries toward ~3.
2. **F2** (parallelize awaits) — verify query count unchanged but the serial chain is gone (read the code / check `Promise.all`); felt effect shows on Vercel, not locally.
3. **F1 → F9** (caching + tag invalidation) last, because it's the only part with a freshness contract to get right — see **Freshness rules** below. Verify tab switches serve from memory (`read_network_requests` shows *no* `?_rsc=` fetch on a <30 s revisit) **and** that a check-in from another account still appears on refresh.

**Invariants that constrain these fixes (from CLAUDE.md — do not break while optimizing):**
- **Sessions are computed, never stored** (`lib/sessions.ts`, 4-hour gap). Bounding history queries (F3) must not change what `groupIntoSessions` sees for the windows it needs (stats = 12 weeks; the active-weeks streak needs its own window; a session can span the boundary — don't truncate mid-session).
- **Celebrate variety, never volume** — no drink-count/pace metrics. When you replace full scans with aggregates, aggregate the things the UI already shows (venues, types, active weeks), not new volume stats.
- **Accent discipline** and **snake_case DTOs via `lib/mappers.ts`** — any new `select` must still flow through the mapper; don't leak Prisma `Decimal` or camelCase into components.
- After `prisma generate` (F10 index), **`docker restart birava-app`** or new columns read back `undefined`.

### Baseline numbers

Server render time = `curl` total (full streamed HTML, i.e. how long the skeleton stays up locally). Query count = Postgres statements per request (includes the proxy's session check). `designtest` account: 17 check-ins, 1 crew.

| Route | Server render (warm) | DB queries | At 2 000 check-ins |
|---|---|---|---|
| `/dashboard` | 38–65 ms (cold 745 ms) | **8** | 50–130 ms (capped at 150 rows) |
| `/stats` | 25–55 ms | 4 | **190–330 ms (8–13×)** |
| `/log` | 16–27 ms | 4 | 14 ms (unchanged — uses `take: 4`) |
| `/crews` | 20–37 ms | **10 (with ONE crew)** | grows with member histories |
| `/crews/[id]` | ~30 ms | 9 | grows with member histories |
| `/profile` | 18–72 ms | 7 | **175–205 ms (10×)** |
| `/people` | 11–27 ms | 4 | — |
| `/achievements` | 14–42 ms | 4 | **155–165 ms (11×)** |
| `/sessions/[id]` | ~35 ms | 10 | bounded (±48 h window) |
| `/api/photos/[entryId]` | ~20 ms | **3 per image** | — |

**Lighthouse (mobile, authenticated, local prod server):**

| Page | Score | FCP | LCP | TBT | CLS | Speed Index |
|---|---|---|---|---|---|---|
| `/dashboard` | 88 | 0.9 s | **3.9 s** | 50 ms | 0 | 0.9 s |
| `/stats` | 90 | 0.8 s | **3.7 s** | 30 ms | 0 | 0.8 s |

**Bundle:** dashboard first load = 60 requests, 463 kB total transfer, **189 kB JS** (largest chunks 70/41/27 kB). Lean for a React app.

**Client navigation behavior (real Chrome, prod):** every bottom-nav tap fires a fresh RSC fetch — `/dashboard` and `/stats` were re-fetched from the server on every single revisit within the same minute. On top of that, nav-link prefetching re-fired repeatedly: `/profile` was prefetched **5×** (distinct `_rsc` keys) in a few navigations without ever being visited. One tap on the Crews tab = **10 DB queries** (Session ×2, User ×3, GroupMember ×3, Group ×1, BeerEntry ×1).

---

## Where the time goes

The FCP→LCP gap is the skeleton time, and it's the whole story. Even with a *50 ms* server, mobile-throttled LCP is 3.9 s while the static shell paints at 0.9 s: **the user watches a skeleton for ~3 s because all real content is dynamic, streamed after the full server query chain, on every navigation.** Breakdown for the slow feeling:

1. **Network/protocol (~60–70 % on mobile):** the RSC payload with the actual content streams only after the server finishes the *last* sequential query. Nothing is served from any cache — not the router cache (dynamic staleTime is 0 in Next 15+/16), not a client data cache (none exists), not the service worker (navigations explicitly bypass it).
2. **Server (~10 % locally, much more on Vercel):** 4–10 sequential DB round-trips per route (3 serial hops before the first page query even starts: proxy session check → `getCurrentUser` session+user → first data query). Locally each hop is ~0.2 ms; on Vercel with a managed Postgres each hop is 2–15 ms, so the same chains cost 10–40× more. Four screens re-read the user's **entire check-in history** per view — already 190–330 ms at 2 000 rows *locally*.
3. **Client JS (~small):** TBT 30–50 ms, CLS 0. The bundle is not the problem.
4. **Repeat visits are as slow as first visits:** zero reuse between navigations. This is the "why is it slow *again*" feeling — it is architecturally guaranteed today.

**Both owner suspicions confirmed.** (1) Caching: `cacheComponents: true` is enabled but there is not a single `"use cache"`, `cacheLife`, or `staleTimes` config in the repo — every route is fully dynamic and re-rendered per request, and the client router cache is effectively off. (2) Wiring: duplicate fetches, N+1s, unbounded queries, and sequential awaits documented below with line numbers.

---

## Findings by impact

### 🔴 F1 — Every tab switch re-renders the whole route server-side behind a skeleton (no cache at any layer)

**Where:** `next.config.ts:6` (`cacheComponents: true`, nothing else), zero `"use cache"` directives repo-wide, no client query cache in `package.json`, `public/sw.js:33` (navigations bypass SW).
**Measured:** every nav tap = fresh `?_rsc=` fetch (observed for every route, every revisit); 10 DB queries per Crews tap; mobile LCP 3.9 s per navigation, including *back to a screen visited 5 seconds ago*.
**Fix (layered, see caching plan):**
- Immediate, one line: `experimental: { staleTimes: { dynamic: 30 } }` in `next.config.ts` — revisits within 30 s serve instantly from the client router cache. This alone kills most tab-switch skeletons.
- Right after: move per-user reads into `"use cache"` functions (userId passed as argument, `cacheTag(\`user:${id}\`)`, `cacheLife("minutes")`), invalidate with `revalidateTag` in the actions. Then even first visits after a mutation are served from the server cache.

### 🔴 F2 — Monolithic pages + sequential awaits: content waits for the slowest/last query

**Where:**
- `app/(app)/dashboard/page.tsx:17-47` — 4 serial DB hops: `getCurrentUser` → follows → entries → `getProostStates`. The follows query runs (and is awaited) even on `?tab=you` where its result is discarded (`page.tsx:24-30`).
- `app/(app)/sessions/[id]/page.tsx:49-123` — 5–6 serial hops (anchor → ±48 h window → full own history for Local Legend → proosts); the last two are mutually independent.
- `app/(app)/profile/page.tsx:18-46` — history fetch and `getFollowCounts` are independent but serialized.
- `app/(app)/log/page.tsx:25-43` — edit lookup and recent-4 are independent but serialized.
- No page has per-region `<Suspense>`; each `loading.tsx` replaces the entire screen until the last byte streams.
**Measured:** serial chain is the direct cause of the 3 s FCP→LCP gap; on Vercel each extra hop costs a full DB RTT.
**Fix:** `Promise.all` the independent queries per page; for the dashboard, render the tabs/frame statically and stream the session list from a nested `<Suspense>`; skip the follows query when `showOnlyOwn`.

### 🔴 F3 — Four screens load the user's entire check-in history, unbounded, all columns

**Where:** `app/(app)/stats/page.tsx:86-89`, `app/(app)/achievements/page.tsx:15-18`, `app/(app)/profile/page.tsx:22-26` (plus a redundant `user` include per row), `app/(app)/profile/[username]/page.tsx:45-49`. Worst: **`logCheckin` fetches the full history twice per check-in** (`lib/actions/beer.ts:36` and `:55`) just to diff achievement ids — the "after" set is provably "before + 1 row".
**Measured:** 8–13× server-time growth at 2 000 rows (25 ms → 330 ms for `/stats`) with a *local* DB; linear in account age, unbounded. This is the app's time bomb — the demo accounts feel fine, real accounts won't.
**Fix:** `select` only needed columns everywhere; add a date floor (stats needs 12 weeks, the streak needs `activeWeeks`' window); replace full-scan aggregates with `groupBy`/`count` queries; in `logCheckin`, fetch once and compute `earnedAfter` from `before + newRow`.

### 🔴 F4 — `/crews` is 2N+2 queries and loads every member's history to print a rank number

**Where:** `app/(app)/crews/page.tsx:25-37` maps memberships → `getCrewBoard(m.groupId)`; each board runs `lib/crews.ts:25-30` (members — already fetched by the page's `include` at `page.tsx:19-23`) + `lib/crews.ts:36-43` (**all** members' entries since the *earliest* join, `include: user`, no `take`; rows before each member's own join are then discarded in JS at `crews.ts:47-49`). `/crews/[id]` repeats the member-list duplicate (`page.tsx:23-26` vs `crews.ts:25-30`).
**Measured:** 10 queries for one 3-member crew; scales as (2 × crews) queries × (members × history) rows.
**Fix:** for the `/crews` index, replace `getCrewBoard` with one `groupBy` counting sessions per member (or cache the board per crew with `cacheTag(\`crew:${id}\`)`); pass the already-fetched member list into `getCrewBoard`.

### 🟡 F5 — Photo pipeline: 3 DB queries per image, full-size originals, no lazy loading, no ETag

**Where:** every `<img src="/api/photos/...">` (`components/beer/session-card.tsx:177`, `app/(app)/sessions/[id]/page.tsx:314-317`) hits `app/api/photos/[entryId]/route.ts:21-48`: session lookup + entry + follow/member ACL check per request, then streams the original bytes (`Cache-Control: private, max-age=86400`, no `ETag`, no resizing — `lib/storage/local.ts` stores uploads verbatim, no size validation). No `next/image` anywhere; no `loading="lazy"`.
**Measured:** 3 queries per image (pg log); a 12-photo feed ≈ 36 extra queries + phone-camera-sized JPEGs on 4G. After 24 h cache expiry everything re-streams fully.
**Fix:** add `loading="lazy" decoding="async"` to all below-fold `<img>` (10 minutes); add `ETag`/`If-None-Match` to the photo route; medium-term, resize/transcode on upload (the storage abstraction is the right seam) and skip the per-image session query by checking the cookie token against a cached session.

### 🟡 F6 — Two session lookups on every request, on every prefetch

**Where:** `lib/auth/proxy-session.ts:7-12` (proxy gate) + `lib/auth/session.ts:70-73` (`getCurrentUser`; React-cached within the render, but the proxy query is separate). `getCurrentUser` also `include: { user: true }` — pulls `passwordHash` and reset-token columns to return 5 fields (`session.ts:70-89`).
**Measured:** Session ×2 in every per-route query count; prefetches pay the proxy query too.
**Fix:** proxy checks cookie *presence* only (cheap gate; invalid sessions still bounce at `getCurrentUser`) — or cache token→expiry in-memory/for the request; switch the include to a `select`.

### 🟡 F7 — Prefetch stampede from the bottom nav

**Where:** `components/layout/bottom-nav.tsx:72` default `<Link>` prefetch × 5 tabs, re-armed per navigation.
**Measured:** `/profile` prefetched 5×, `/stats`/`/log`/`/crews`/`/dashboard` 3× each within a few taps — each hitting the proxy (and its DB query). With `staleTimes` off, the prefetched payloads are discarded anyway: pure waste today.
**Fix:** F1's `staleTimes` makes prefetches actually get reused; until then consider `prefetch={false}` on the nav (the shells are trivial) — re-evaluate after F1.

### 🟡 F8 — First load renders everything twice (timezone sync)

**Where:** `components/timezone-sync.tsx:17-27` — when the `birava_tz` cookie is missing/stale, it sets the cookie and `router.refresh()`es: the full query chain runs once in UTC, then again in the real TZ. One-time per device/TZ change, but it doubles the very first impression.
**Fix:** inline a tiny script in the root layout that sets the cookie *before* hydration (document.cookie in `<head>`), so the first server render already sees it.

### 🟡 F9 — Post-mutation over-invalidation

**Where:** `lib/actions/beer.ts:11-17` — every check-in revalidates 5 paths + 2 layouts; `lib/actions/social.ts:32-33` — every proost tap revalidates `/dashboard` + the whole `/sessions` layout. Client components then *also* call `router.refresh()` (`components/beer/log-beer-form.tsx:132,181,197`, `components/beer/crews-forms.tsx:26,72`, `components/profile/profile-client.tsx:59`) — a second render of the current route per mutation. Meanwhile follow/unfollow misses `/profile/[username]` where the count actually shows (`social.ts:49-62`).
**Fix:** with F1's tags, `revalidateTag("user:...")`/`("crew:...")` instead of the path hammer; drop the redundant `router.refresh()` calls.

### 🟡 F10 — Missing composite index for the app's hottest query shape

**Where:** `prisma/schema.prisma:83-85` — `BeerEntry` has `[userId]` and `[createdAt DESC]` separately, but every hot query filters `userId (IN …)` + orders/ranges `createdAt` (dashboard `page.tsx:32-37`, sessions window, crews board, stats). Add `@@index([userId, createdAt(sort: Desc)])`. Redundant: `Proost @@index([entryId])` (`:98`) and `Follow @@index([followerId])` (`:109`) duplicate their PK prefixes. `passwordResetToken` lookup is an unindexed scan (`app/api/auth/reset-password/route.ts:28`). Also `lib/db.ts` has no connection-limit config — on Vercel serverless + direct Postgres this risks connection exhaustion.
**Impact:** invisible at 17 rows, matters exactly when F3 starts hurting.

### 🟡 F11 — People search fires a server action per keystroke

**Where:** `components/beer/people-client.tsx:28-40` — `searchUsers` POST on every keystroke ≥ 2 chars, no debounce, no stale-response guard (out-of-order responses can clobber newer results); each POST pays a session query (`lib/actions/social.ts:75-93`).
**Fix:** 250 ms debounce + a sequence counter.

### 🔵 F12 — Skeletons advertise a different page than what renders

**Where:** `app/(app)/dashboard/loading.tsx:10-23` (header + 2×2 stats grid vs the real tabs + session cards), same mismatch for `stats/loading.tsx`, `people/loading.tsx`, `profile/loading.tsx`, `profile/[username]/loading.tsx`; `/achievements` has **no** loading.tsx (blank main during nav, layout fallback is `null` at `app/(app)/layout.tsx:24`). The four newer skeletons (`log`, `crews`, `crews/[id]`, `sessions/[id]`) match correctly.
**Fix:** rewrite the five stale skeletons to mirror the actual layout; add `achievements/loading.tsx`. Cheap, kills the skeleton→content layout jump on the two most-visited tabs.

### 🔵 F13 — Service worker does nothing for the felt speed of a PWA

**Where:** `public/sw.js` — precaches 3 files (manifest + 2 icons), runtime-caches only hashed static assets, explicitly bypasses navigations (`sw.js:33`) and `/api/*`. Offline = browser error page. Dead Supabase branch at `sw.js:29`.
**Fix (optional):** offline fallback page + stale-while-revalidate for `/api/photos/*`. Do after F1/F2 — the SW is the wrong layer to fix tab switching.

### 🔵 F14 — Minor
- `/log` mount fires geolocation + an external Nominatim reverse-geocode every visit when permission is granted (`components/beer/log-beer-form.tsx:98-107`) — cache last venue/coords for the session.
- `URL.createObjectURL` never revoked (`log-beer-form.tsx:113`).
- Source Serif 4 loads an italic axis that roughly doubles that font's payload (`app/layout.tsx:6-16`) — drop if italics are rare.
- `recharts` + `framer-motion` + 3 Radix packages are installed but never imported (`package.json:28,33,34,42,48`) — not in the bundle, but slow installs and a one-import footgun; uninstall.

---

## The caching plan (target state, as a checklist)

**Layer 1 — client router cache (the tab-switch fix):**
- [ ] `next.config.ts`: `experimental: { staleTimes: { dynamic: 30, static: 300 } }` — revisits within 30 s render instantly from memory; prefetches (F7) become useful instead of waste.
- [ ] Verify against `node_modules/next/dist/docs/.../staleTimes.md` semantics with `cacheComponents` — measured here on 16.2.9, config key exists and dynamic default is 0.

**Layer 2 — server render cache (`"use cache"`, the repeat-render fix):**
- [ ] Extract per-user reads into cached functions: `getFeedEntries(userIds)`, `getUserHistoryStats(userId, tz)`, `getCrewBoard(groupId)` → `"use cache"` + `cacheLife("minutes")` + `cacheTag(\`user:${id}\`)` / `\`crew:${id}\``. Cookies stay in the page; ids are passed in as arguments.
- [ ] Actions switch from `revalidatePath` × 7 to `revalidateTag` on the writer's tags (`lib/actions/beer.ts:11-17`, `social.ts:32-33`).
- [ ] Remove client `router.refresh()` after actions that already revalidate.

**Layer 3 — queries & DB:**
- [ ] `Promise.all` the independent awaits (dashboard, profile, log, sessions/[id]).
- [ ] Bound/aggregate the four full-history screens; single fetch in `logCheckin`.
- [ ] Replace `/crews` boards with one `groupBy`; reuse the member list already fetched.
- [ ] `@@index([userId, createdAt(sort: Desc)])` on `BeerEntry`; drop the two redundant indexes; index or hash `passwordResetToken`.
- [ ] Proxy: cookie-presence check instead of a DB query per request; `select` instead of `include` in `getCurrentUser`.
- [ ] Set `connection_limit` in `DATABASE_URL` (or pool via pgbouncer/Prisma Accelerate) before real Vercel traffic.

**Layer 4 — HTTP / assets:**
- [ ] `loading="lazy" decoding="async"` on all feed/gallery `<img>`; `ETag` handling in `app/api/photos/[entryId]/route.ts`; resize on upload.
- [ ] Add build to CI (it passes now).

**Layer 5 — service worker (last):**
- [ ] Offline fallback page; SWR caching for `/api/photos/*`; delete the Supabase branch.

### Freshness rules (this is a social app — cache must never hide a friend's check-in)

The plan is event-driven invalidation, not time-based staleness:

- **Server cache is invalidated by the write, not by a timer.** `logCheckin` calls `revalidateTag` for the writer's tag in the same action — every cached feed containing that user is busted at the moment the beer is logged. The server cache therefore only serves responses when nothing relevant has changed; it can never show a stale check-in. `cacheLife` acts as a safety-net TTL, not the freshness mechanism.
- **Tag design for the feed:** tag cached feed reads with the tag of every user whose entries they include (viewer + followed users), so one friend's check-in invalidates exactly their followers' feeds. Same for `crew:<id>` on crew boards and proost tags on session pages.
- **Own history/stats/achievements are the ideal cache:** they change only on the viewer's own writes → cached view is instant and provably current; recomputed once after each own check-in.
- **The only true staleness window is the client router cache** (`staleTimes.dynamic`): returning to a tab visited < N seconds ago shows that N-seconds-old copy. Keep N small (10–30 s). Any pull-to-refresh / hard reload in the PWA bypasses it entirely and hits the (now fast) fresh path. If even a 10 s window is unacceptable for `/dashboard` specifically, keep `staleTimes` off and rely on Layers 2–4 — tab switches then still refetch, but the refetch drops from ~1–3 s to low hundreds of ms.
- **"See it appear while I'm already looking at the feed"** is push/polling (WebSocket or interval revalidate), not a caching property — the current zero-cache app doesn't have it either. Separate feature if wanted.

---

## Top five speed wins (felt improvement ÷ effort)

How the halves fit together: **wins 3–5 make the fresh path fast** (first loads, pull-to-refresh, post-check-in) and carry **zero freshness trade-off** — the same fresh data is fetched on every view, just without the waste (Postgres does the filtering/aggregating instead of shipping full history to Node; the same queries run in parallel instead of serially; only below-fold images defer, and a check-in photo never changes after upload so ETag/immutable caching can never show a wrong image). **Wins 1–2 stop re-running the fresh path when provably nothing changed**, with freshness guaranteed by write-time tag invalidation (see "Freshness rules" above). They're independent: 3–5 could ship alone with no caching at all and every screen still gets dramatically faster — just not instant-from-memory on tab switches.

1. **Turn on the client router cache** — `staleTimes: { dynamic: 30 }`, one config line. Tab switches within 30 s render instantly from memory instead of a ~1–3 s skeleton round-trip. This is the single biggest lever on the exact complaint ("skeletons on every tab switch") and it also makes the existing prefetch traffic useful.
2. **Adopt `"use cache"` + `cacheTag` for the per-user/per-crew reads, invalidated in the actions** (~1 day). First visits and post-30 s visits also stop paying the full query chain; a check-in invalidates only that user's tag instead of the entire app. Removes the remaining seconds Layer 1 doesn't cover.
3. **Bound the history queries + fix `logCheckin`'s double full-table read** (~half a day). Caps the O(account-age) growth: at 2 000 check-ins this is already 200–300 ms of pure server time per view of stats/profile/achievements *on a local DB* — it's the difference between the app staying fast and degrading month by month. Logging a drink also stops re-reading your life twice.
4. **Parallelize per-page queries and de-N+1 `/crews`** (~half a day). Cuts 4–10 serial DB round-trips to 2–3; on Vercel (2–15 ms per hop) that's hundreds of ms off every first paint, and `/crews` stops scaling with members × history.
5. **Lazy-load feed images + ETag on the photo route** (~1 hour). Stops 12 eager multi-hundred-kB image fetches (×3 DB queries each) from competing with content on every dashboard load; repeat visits revalidate with 304s instead of re-streaming.

## What's already fast

- **The JS bundle** — 189 kB transfer, TBT 30–50 ms, CLS 0. Server/client component split is textbook (23 small client leaves, pages fully server); recharts/framer-motion never ship; confetti is dynamically imported at trigger time; lucide is tree-shaken via Next's `optimizePackageImports`.
- **Fonts** — `next/font` self-hosted, preloaded, no render-blocking fetch.
- **The good query patterns to copy:** `/log`'s `take: 4`, `/sessions/[id]`'s ±48 h window (`page.tsx:64-74`), `/profile/[username]`'s `Promise.all` (`page.tsx:31-50`), dashboard's 150-row cap.
- **Optimistic UI** — proost toggle and follow buttons settle server-side without blocking (`components/beer/social-row.tsx:24-39`).
- **`getCurrentUser` React-cache dedup** within a render (layout + page share one query) works as designed.
- **The maps** — server-rendered SVG, zero client cost.

*Not measured: Vercel staging (would add serverless cold starts + real DB RTT on top of everything above — expect the sequential-query findings to weigh heavier there, not lighter).*
