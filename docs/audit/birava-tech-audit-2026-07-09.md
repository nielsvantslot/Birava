# Birava — Technical Audit

**Date:** 2026-07-09
**Commit:** `b57377a` (branch `feature/frontend-redesign`; working tree dirty — mid-redesign)
**Auditor:** senior engineer, pre-launch review
**Method:** Full static read of every source file (auth, API routes, server actions, Prisma schema, service worker, config) + production build run locally to measure the bundle. No live backend/credentials were exercised, so authorization behavior is inferred from code, not from hitting endpoints (called out where it matters).

---

## Baseline numbers (measured)

| Metric | Value | Notes |
|---|---|---|
| Client JS, all chunks | **1071 KB raw / 322 KB gzipped** | Measured from `.next/static/chunks` after a clean build |
| Largest chunk | 222 KB raw / **69 KB gz** | React + framework |
| Next chunks | 127 KB / 109 KB / 107 KB raw | framer-motion + Radix + app code |
| CSS | 45 KB raw / **9.4 KB gz** | single Tailwind v4 file |
| Runtime deps | 21 (see `package.json`) | 1 dead (`recharts`), 3 unused Radix packages |
| `node_modules` | 790 MB / 362 packages | |
| `npm audit` | **5 vulns: 3 high, 2 moderate** | `effect` (via prisma) high; `postcss` (via next) moderate |
| Lighthouse | **not run** | Build does not complete with production config (see 🔴-1); could not serve a prod build to measure LCP/CLS/TBT |

> ⚠️ **The production build does not succeed with the committed config.** `next build` fails prerendering `/reset-password` and `/leaderboard/[groupId]`. The bundle numbers above were obtained by temporarily setting `cacheComponents: false` (reverted). This is finding 🔴-1 and it blocks deploy today.

---

## Findings by severity

### 🔴 Exploitable / data-leaking / app-breaking

#### 🔴-1 — Production build is broken (app cannot ship)
**Where:** `next.config.ts:6` (`cacheComponents: true`) + `app/(auth)/reset-password/page.tsx:13` (`useSearchParams`) + `components/layout/bottom-nav.tsx:75` (`usePathname`).
**What:** With Cache Components enabled, Next 16 requires any uncached dynamic hook (`useSearchParams`, `usePathname`) to sit inside a `<Suspense>` boundary. Neither does, so `next build` throws `Uncached data was accessed outside of <Suspense>` and exits non-zero on `/reset-password`, then `/leaderboard/[groupId]` (the nav renders on every app route).
**Impact:** `vercel.json` runs `npm run db:migrate && npm run build`; the build step fails, so **nothing deploys**. This is the single most urgent item.
**Fix:** Wrap the hook-using client subtree in Suspense. For the nav, split the `usePathname` consumer into a child and render `<Suspense><NavInner/></Suspense>`; same pattern for `ResetPasswordPage`. Then re-enable and keep `cacheComponents: true`. Add `next build` to CI so this can never merge again.

#### 🔴-2 — Password-reset token returned in the HTTP response → account takeover
**Where:** `app/api/auth/forgot-password/route.ts:34-38`
```ts
return Response.json({ success: true, resetUrl: `${origin}/reset-password?token=${token}` });
```
**How exploited:** Anyone (unauthenticated) POSTs `{email: "victim@x.com"}` to `/api/auth/forgot-password`. The response body contains a live reset link with the token. The attacker opens it and sets a new password. **Full takeover of any account whose email you know or guess.** No email is ever sent; the token never leaves the response, so email possession — the entire point of reset — is bypassed.
**Severity:** Critical. This is the worst finding in the codebase.
**Fix:** Never return the token. Send it via email (Resend/Postmark/SES). In local dev, log it server-side (`console.log`) or gate the `resetUrl` behind `process.env.NODE_ENV !== "production"` **and** a dev-only flag. Also: hash the token at rest (store `sha256(token)`, compare hashes) so a DB read can't mint resets; and always return the same generic `{success:true}` regardless of whether the email exists (it already does — keep that).

#### 🔴-3 — Photo upload endpoint has zero server-side validation
**Where:** `app/api/uploads/beer-photo/route.ts:12-19`, `lib/storage/local.ts:11-22`
**What:** The route accepts any `File` from `formData`. There is **no** content-type check, **no** magic-byte check, **no** size limit, and **no** EXIF stripping. The stored extension is taken from the user-supplied filename: `path.extname(file.name)`.
**Impact (three separate criticals):**
- **Stored XSS on your own origin.** `accept="image/*"` is client-side only. An attacker POSTs a file named `x.html` (or `.svg`) with `<script>` inside. It is written under `public/uploads/beer-photos/<uid>/<uuid>.html`, served **from the app origin** with an HTML/SVG content-type, and there is no `X-Content-Type-Options: nosniff` (see 🔴-6). Visiting the URL executes script in Birava's origin → session/cookie-adjacent attacks against any logged-in viewer. (The session cookie is `httpOnly`, which blocks direct `document.cookie` theft, but same-origin script can still call your server actions as the victim, read the DOM, exfiltrate feed data, etc.)
- **Disk-fill / cost DoS.** No max size. A script can POST a 500 MB "photo", or thousands of them (no rate limiting — 🔴-5).
- **Privacy: EXIF GPS leak.** Phone photos carry GPS. Nothing strips metadata, so a user's home coordinates ride along in the stored file and are downloadable by anyone who can see the feed image. For a social beer app this is a privacy incident waiting to happen.
**Fix:** On the server: read the buffer, sniff magic bytes (accept only JPEG/PNG/WebP/HEIC signatures), reject anything else; enforce a hard byte cap (e.g. 8 MB) before writing; re-encode through `sharp` (`.rotate()` to bake EXIF orientation, then `.webp({quality:80})`) which also **strips all metadata**; never trust `file.name` for the extension — derive it from the sniffed type. See the image-pipeline section for the full spec.

#### 🔴-4 — Uploads write to the local filesystem — the photo feature is broken on Vercel
**Where:** `lib/storage/local.ts:5,15,19` (`fs.writeFile` into `process.cwd()/public/uploads`), deploy target `vercel.json:7` (`regions: ["iad1"]`, Next serverless).
**What:** Photos are written to `public/uploads/beer-photos/...` at runtime. Vercel's serverless/edge runtime has a **read-only filesystem** except `/tmp`, and `/tmp` is ephemeral and per-instance. `fs.writeFile` will either throw `EROFS` in production or (at best) write to a throwaway sandbox that the static file server never serves and that vanishes on the next cold start.
**Impact:** App-breaking for the flagship feature. In production, uploading a beer photo will error or silently lose the file; the feed image 404s. This works only on a long-lived local `next start`.
**Fix:** Move object storage off the app filesystem: Vercel Blob, S3, Cloudflare R2, or Supabase Storage. Store the returned URL in `BeerEntry.photoUrl`. This also unlocks CDN delivery, signed URLs, and image transforms (pipeline section). `public/uploads/` is currently untracked and must never be committed.

#### 🔴-5 — No rate limiting anywhere
**Where:** all of `app/api/**` and `lib/actions/**` (grep for `rate`/`throttle` → none).
**What / impact:**
- `POST /api/auth/login` — unlimited password guesses → credential stuffing / brute force (`app/api/auth/login/route.ts`).
- `POST /api/signup` — mass fake-account creation.
- `POST /api/uploads/beer-photo` — unlimited large uploads (compounds 🔴-3).
- `addBeer` server action — a script can create 10,000 check-ins; nothing stops it.
- `joinGroupByInvite` — unlimited invite-code attempts → enumeration (compounds 🟡-7).
**Fix:** Add IP + account rate limiting at the edge. `@upstash/ratelimit` + Upstash Redis is the least-friction fit for Vercel: a sliding window (e.g. 5 login attempts / 15 min / IP+email, 20 writes / min / user). Apply in each route handler and in a shared wrapper for server actions.

#### 🔴-6 — No security headers (no CSP, HSTS, nosniff, Referrer-Policy)
**Where:** `next.config.ts` has no `headers()`; `vercel.json` sets none.
**What:** An app that serves **user-generated images from its own origin** ships with no `Content-Security-Policy`, no `X-Content-Type-Options: nosniff`, no `Strict-Transport-Security`, no `Referrer-Policy`. Missing `nosniff` is what turns 🔴-3's uploaded `.svg`/`.html` into executable content; missing CSP removes the backstop that would neuter injected script.
**Fix:** Add a `headers()` block in `next.config.ts` (or `vercel.json`): `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, `X-Frame-Options: DENY`, and a real `Content-Security-Policy` (`default-src 'self'`; allow the CARTO tile host and OSM/Nominatim you already call; `img-src 'self' https: data:`; no `unsafe-inline` for scripts). Serve uploads from a separate storage origin (see 🔴-4) so the image CDN can't host active content on your app origin at all.

---

### 🟡 Degrades speed, cost, or maintainability

#### 🟡-1 — No offline check-in queue (the core use case fails in a bar)
**Where:** `public/sw.js:24-53`, `components/beer/log-beer-form.tsx:117-149`
**What:** The service worker network-passes navigations and runtime-caches only `/_next/static`, `/icons`, `/manifest.json`. There is **no** write queue. `LogBeerForm` calls `fetch("/api/uploads/...")` then the `addBeer` server action directly; with no connectivity both reject and the user sees "Failed to upload photo." / "Failed to save beer." The audit's flagged #1 question — *can a check-in be created offline and synced later?* — answers **no**.
**Impact:** The app's primary action happens in bars with bad wifi, and it just fails there.
**Fix:** Queue writes in IndexedDB and replay via Background Sync. Persist the pending check-in (+ the photo blob) to IndexedDB on submit, show it optimistically, register a `sync` event; on `sync` (or next online) POST the photo then call the create endpoint. Libraries: Workbox `BackgroundSyncPlugin` (pairs with a real SW build) or a small custom queue. Note this needs the upload path to be a normal `fetch`-able POST (it is) and storage to be remote (🔴-4).

#### 🟡-2 — Service worker update strategy + dead Supabase code
**Where:** `public/sw.js:1,29`
**What:** `skipWaiting()` + `clients.claim()` on a hand-written SW that only versions via the `CACHE_NAME = "birava-v2"` string. Since only immutable `/_next/static` is cached and navigations are always network, staleness risk is low — acceptable. But the SW still contains `if (url.hostname.includes("supabase.co")) return;` (`sw.js:27-29`), dead code from the pre-Prisma stack, and the app no longer uses Supabase at all.
**Fix:** Remove the Supabase branch. Consider generating the SW with Workbox (needed anyway for 🟡-1) so precache manifests are content-hashed and updates are deterministic.

#### 🟡-3 — All images are raw `<img>` — CLS, no lazy-load, no responsive sizes
**Where:** 14 `<img>` across `app/(app)/feed/page.tsx:91`, `dashboard/page.tsx:50,75`, `components/beer/beer-card.tsx:107,162`, avatars in feed/dashboard/profile. **Zero** use of `next/image`.
**What:** Feed photos set `width:100%; maxHeight:300; objectFit:cover` but have **no intrinsic `width`/`height` or `aspect-ratio`**, so the feed reflows as each image loads → high CLS (the #1 CLS killer in a photo feed). No `loading="lazy"`, no `decoding="async"`, no `srcset`/`sizes`, no placeholder. A 390 px phone downloads whatever full-size file was uploaded. Avatars render the same full photo URL into a ~42 px circle.
**Impact:** Janky feed, wasted bandwidth on bar wifi, poor LCP.
**Fix:** See the image-pipeline section — this is the bulk of that gap list. Minimum: give every `<img>` a fixed `aspect-ratio`, add `loading="lazy" decoding="async"` to below-the-fold images and `fetchpriority="high"` to the first feed image, and generate a tiny dedicated avatar size.

#### 🟡-4 — `framer-motion` shipped for one fade; `recharts` + 3 Radix packages are dead weight
**Where:** `components/beer/beer-card.tsx:6,53-57` (only `framer-motion` use); `package.json:43` `recharts` (imported **nowhere**); `@radix-ui/react-progress`, `-separator`, `-toast` (0 references).
**What:** `framer-motion` (one of the large chunks) is pulled in for a single `initial/animate/layout` fade that a 3-line CSS keyframe would do. `recharts` (~hundreds of KB installed) is never imported — stats charts are hand-rolled SVG (`stats/page.tsx`), so it's pure install/audit weight. Three Radix packages are unused.
**Fix:** Replace the `beer-card` motion with a CSS `@keyframes fade-up` and drop `framer-motion`. `npm rm recharts @radix-ui/react-progress @radix-ui/react-separator @radix-ui/react-toast`. Re-measure; expect a meaningful cut to the 322 KB.

#### 🟡-5 — `npm audit`: 3 high / 2 moderate
**Where:** `effect <3.20.0` (transitive via `prisma`/`@prisma/config`) — high; `postcss <8.5.10` (transitive via `next`) — moderate (CSS-stringify XSS).
**What:** Both are transitive. The postcss one is build-time only (low real risk). The effect ones ride in via Prisma tooling.
**Fix:** `npm audit fix` for the non-breaking set; bump Prisma to a patched line when available. Don't `--force` (it wants to downgrade Next to 9.x). Re-run in CI.

#### 🟡-6 — Duplicated domain logic: streak math and the check-in form exist in multiple copies
**Where:** streak recomputed in `app/(app)/stats/page.tsx:23-34`, `app/(app)/profile/[username]/page.tsx:19-43`, `components/beer/profile-client.tsx`, `app/(app)/log/page.tsx`; two full beer-entry forms: `components/beer/log-beer-form.tsx` (363 lines) and `components/beer/add-beer-dialog.tsx` (362 lines).
**What:** "Streak" is implemented at least three different ways with subtly different rules (`stats` uses `startOfDay/toDateString`, `profile/[username]` uses `toLocaleDateString` + `getDate/getMonth/getYear`). This is exactly the kind of logic that silently diverges — two screens will show different streaks for the same user. The two forms duplicate ~350 lines of field state, photo upload, and submit.
**Impact:** Maintainability + correctness drift; no test guards any of it (🟡-8).
**Fix:** Extract `lib/streak.ts` with a single `computeStreak(dates: Date[]): number` and unit-test it. Extract the shared form body into one `<BeerEntryForm mode="create"|"edit">` consumed by both the `/log` page and the edit dialog.

#### 🟡-7 — Invite codes use `Math.random` and are short/enumerable
**Where:** `lib/utils.ts:35-37` — `Math.random().toString(36).substring(2,8).toUpperCase()`
**What:** Not cryptographically random (predictable across a run), and `substring(2,8)` can yield **fewer than 6 chars** when the fractional part is short, shrinking the space. Alphabet is `[0-9A-Z]`. With no join rate limit (🔴-5), codes are brute-forceable to walk into strangers' crews and read members' check-ins.
**Fix:** `crypto.randomBytes` over an unambiguous alphabet (drop `0/O/1/I/L`), fixed length 8–10, e.g. a `nanoid` custom alphabet. Enforce uniqueness (already `@unique`) with retry. Pair with join rate limiting.

#### 🟡-8 — No tests on any critical path
**Where:** repo-wide — no test files, no test runner in `package.json`.
**What:** Auth, check-in creation, streak calculation, leaderboard aggregation — none are covered. Streak and leaderboard are pure functions begging for unit tests.
**Fix:** Add Vitest. First targets: the extracted `computeStreak` (🟡-6), `lib/leaderboard.ts:buildLeaderboard`, `lib/sessions.ts:groupIntoSessions`, and an integration test for the login → session → `getCurrentUser` round-trip.

#### 🟡-9 — Two coexisting styling systems (redesign half-done)
**Where:** inline-style + `globals.css` custom classes (`feed`, `dashboard`, `log`, `crews`) vs Tailwind-utility + CSS-var classes (`profile/[username]`, `leaderboard`, `beer-card`, all of `components/ui/*`).
**What:** The branch is a redesign in progress; some screens use hand-written CSS classes and heavy inline `style={{…}}`, others use Tailwind. Design tokens live as CSS vars in `globals.css` and are mostly consumed, but there are 9 hardcoded hex values in `globals.css` and 5 in TSX. Two systems double the surface area for visual bugs.
**Fix:** Pick one (Tailwind v4 is already configured and used by `components/ui`). Migrate the inline-style screens onto utility classes + tokens; replace stray hex with `var(--…)`. Track it as a redesign checklist, not a big-bang rewrite.

---

### 🔵 Cleanup

- **🔵-1 `alert()`/`confirm()` for all destructive UX** — `beer-card.tsx:28,32`, `group-leaderboard-client.tsx:33-49`, `groups-client.tsx:39-96`, `board-groups-client.tsx:34-49`. Native dialogs block the event loop (and, per the browser-automation caveat, are hostile to any embedded/PWA context). Replace with the existing `toast-pill` + a real confirm dialog (`components/ui/dialog.tsx` already exists).
- **🔵-2 `addBeer`/`editBeer` trust `photo_url` verbatim** — `lib/actions/beer.ts:45,93`. The client can pass any string (external URL, another user's upload path). Not currently exploitable beyond rendering an arbitrary image, but validate it points at your own storage prefix before persisting.
- **🔵-3 Client-side reverse geocoding to Nominatim** — `log-beer-form.tsx:26-45` calls `nominatim.openstreetmap.org` directly from the browser on every location capture. OSM's usage policy requires a proper `User-Agent`/attribution and rate discipline you can't set from `fetch`; at scale you'll get blocked. Proxy it server-side (or use a paid geocoder) and cache.
- **🔵-4 Leftover Supabase references** — `public/sw.js:27-29` (see 🟡-2).
- **🔵-5 `getPublicRecentEntries` is unused** — `lib/actions/social.ts:131-147` has no call sites. Dead code.
- **🔵-6 `maximumScale: 1, userScalable: false`** — `app/layout.tsx:38-39` disables pinch-zoom, an accessibility regression. Drop it unless there's a hard reason.
- **🔵-7 Deleted-but-referenced-in-git components** — `stats-charts.tsx`, `top-bar.tsx`, `add-beer-fab.tsx`, `last-24h-recap.tsx` were removed on this branch; make sure nothing imports them before merge (build currently passes TS, so likely clean — verify).

---

## The image pipeline — current state vs target

Photos are the heaviest thing this app will move, and **almost none of the pipeline exists**. Current behavior: the browser hands the raw camera file straight to `/api/uploads/beer-photo`, which writes it to disk unchanged; the feed renders it in a raw `<img>`.

### Gap list (implement top to bottom)

**Upload path**
- [ ] **Client resize/compress before upload.** Today `log-beer-form.tsx:100-105` sends the raw `File`. A 12 MP iPhone HEIC travels whole over bar wifi — and worse, **HEIC won't even render in a feed `<img>`** in most browsers, so the photo appears broken. Add a canvas (or `browser-image-compression`) step: decode → cap longest edge at ~2048 px → export WebP q≈80 (JPEG fallback) → target ≤ ~400 KB. This also side-steps HEIC.
- [ ] **Server re-encode + strip metadata + fix orientation.** Pipe every upload through `sharp`: `.rotate()` (bakes EXIF orientation, kills the "photo is sideways" bug), re-encode, and metadata is dropped by default → **EXIF GPS stripped** (fixes 🔴-3 privacy). Validate magic bytes and size here too.
- [ ] **Generate multiple sizes on ingest** — thumb ~200 px (avatars/grids), feed ~800 px, detail ~1600 px. Store all three keys.
- [ ] **Format negotiation** — serve AVIF/WebP with JPEG fallback. Trivial if you move to a storage CDN with transforms (Vercel Blob + `next/image`, Cloudflare Images, or Supabase Storage `render/image`).
- [ ] **Move off the app filesystem** (🔴-4) — this is the precondition for all of the above being durable in production.

**Display path**
- [ ] **Intrinsic dimensions on every `<img>`** — set `width`/`height` or a CSS `aspect-ratio` so the feed doesn't reflow (fixes the CLS in 🟡-3). `dashboard/page.tsx` already does this for its multi-photo grid (`aspectRatio: "4 / 3"`) — extend the pattern to `feed/page.tsx:91` and `beer-card.tsx`.
- [ ] **`loading="lazy"` + `decoding="async"`** on below-the-fold images; **`fetchpriority="high"`** (eager) on the first feed image (likely the LCP element).
- [ ] **`srcset`/`sizes`** so a 390 px phone pulls the ~800 px feed size, not the 1600 px detail. `next/image` gives this for free once images live on an allowed remote host (`next.config.ts images.remotePatterns`).
- [ ] **Placeholder** — dominant-color or blurhash while loading instead of white gaps. Store a tiny base64 blur on ingest and pass as `next/image` `placeholder="blur"`.
- [ ] **Dedicated avatar size** — feed/dashboard/profile render the full photo URL into ~42 px circles. Serve the 200 px thumb (or smaller) for avatars, cached aggressively.

**Recommended stack fit:** you're on Next 16 + Vercel. The lowest-friction path is **Vercel Blob for storage + `next/image` for display + `sharp` for ingest transforms** — all first-party, no new infra. If cost matters at scale, Cloudflare R2 + Images is the cheaper equivalent.

---

## Top five actions (ranked by risk-reduction per hour)

1. **Stop returning the reset token; send it by email (or dev-gate it).** (🔴-2) One file, ~15 min, closes a trivial full-account-takeover hole. Highest risk reduction per minute in the whole repo.
2. **Fix the build: wrap `useSearchParams`/`usePathname` in Suspense and add `next build` to CI.** (🔴-1) ~30 min. Without this, nothing you fix can actually ship.
3. **Lock down uploads: magic-byte + size check, `sharp` re-encode (strips EXIF, fixes orientation), and move storage to Vercel Blob/S3.** (🔴-3, 🔴-4) Half a day. Simultaneously fixes stored-XSS, the disk-DoS, the GPS privacy leak, **and** the fact that the photo feature doesn't work on Vercel at all.
4. **Add rate limiting (Upstash) to login, signup, uploads, invite-join, and write actions; regenerate invite codes with `crypto`.** (🔴-5, 🟡-7) ~half a day, blocks brute force / spam / enumeration across the board.
5. **Add security headers (`nosniff`, CSP, HSTS, Referrer-Policy) in `next.config.ts`.** (🔴-6) ~1 hour, and it's the backstop that de-risks the upload surface even if something slips through #3.

---

## What's solid (don't refactor)

- **Session auth fundamentals are good.** Opaque `crypto.randomUUID` tokens stored server-side in `Session`, cookie is `httpOnly` + `sameSite=lax` + `secure` in prod + 30-day expiry that's actually checked and cleaned up (`lib/auth/session.ts`). `getCurrentUser` is `react`-`cache`d to dedupe per request. This is the right shape — leave it.
- **Passwords** are bcrypt-hashed with a proper cost, never returned to the client, and the feed/profile payloads correctly omit `email` and hashes (`lib/mappers.ts`, `getSocialFeed`). No secrets in the client bundle; `.env` is git-ignored and only `.env.example` is tracked.
- **Ownership checks on mutations are correct.** `editBeer`/`deleteBeer` scope by `{id, userId}` (`lib/actions/beer.ts`), `leaveGroup`/`deleteOwnedGroup` verify ownership, and the upload `DELETE` path constrains to the caller's own prefix. No obvious IDOR in the write paths.
- **Data fetching is mostly clean** — no N+1s: feed/dashboard/leaderboard fetch with a single `findMany … where userId in [...]` + a joined `user` select, and crews uses one `groupBy`. Lists are bounded (feed 30, dashboard 120→12 sessions, profile 20). Server components + server actions keep data on the server.
- **Charts and the session map are dependency-free hand-rolled SVG** (`stats/page.tsx`, `session-map.tsx`) — genuinely lighter than pulling in a chart lib. Good call; it's why `recharts` can just be deleted.
- **TypeScript discipline is high** — domain nouns typed in `lib/types.ts`, mappers centralize the DB→UI shape, minimal `any`.
