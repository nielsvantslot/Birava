# HANDOFF

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
