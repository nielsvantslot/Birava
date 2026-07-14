# Header cleanup + session share card

Date: 2026-07-14
Branch: `feature/header-cleanup-session-share` (off `dev`)
Origin: Niels' feedback — trim the top menu bar to just the bell, and rework the session share.

## A. Header cleanup (`components/layout/app-header.tsx`)

Strip the right-side cluster from **bell · + · gear** to just **bell**.

- Remove the `+` icon (links to `/log`) — redundant with the Log bottom-nav tab.
- Remove the entire gear `DropdownMenu` (username label, Profile, Find people, Achievements, Sign out).
- Keep the bell (notifications) with its unread badge.
- Keep the left avatar / back-arrow slot.

Nothing is orphaned:
- Profile → You tab + avatar link (existing)
- Achievements → profile "See all" (existing)
- Sign out → `ProfileActions` on the profile page (existing, `profile/page.tsx:139`)
- Find people → moves to Crews (section B)

Desktop: the mobile header is `md:!hidden`; navigation on desktop is `sidebar-nav.tsx`. Ensure Find people is reachable there too (it already links `/people`, or add it).

Unused imports (`DropdownMenu*`) get removed. `username`/`avatarUrl` props: avatar still used; `username` only fed the dropdown label — drop the prop if no longer used.

## B. Find people → Crews (`app/(app)/crews/page.tsx`)

Add a "Find people" entry at the top of the Crews page, above "Your crews", linking to `/people`. Reuse the existing `.row`/`.section` markup. `/people` route unchanged.

## C. Session share card

User-initiated, from the existing Share button in `components/drink/social-row.tsx` (currently a plain `navigator.share({ text })`).

**Content** (2.0-styled, ink/accent — not the old orange 1.0 card):
`N drinks · M types · Xh Ym` · venue(s) · route map · session photos · `birava.nl` footer · title "session recap".
- No pace / drinks-per-hour (stays PARKED).
- Lone check-in: show "single check-in" instead of a duration span.
- Duration = span between first and last check-in in the session.

**Generation: server-rendered PNG via `next/og` `ImageResponse`.**
- New auth-gated route, e.g. `app/(app)/sessions/[id]/share/route.tsx` (or route handler).
- Authenticate via `getCurrentUser()`; verify the caller may see the session (ownership / visibility).
- Load photo bytes **directly from the storage layer** (`lib/storage`), NOT the auth-gated `/api/photos/[entryId]` HTTP route — a server-to-server fetch of that route 401s (documented image-pipeline landmine). Embed as data URIs.
- Map: composite the same CARTO tiles `session-map.tsx` computes (Web Mercator tile math already exists there). This is the highest-effort element.
- Return `image/png`.

**Client wiring:** Share button fetches the PNG blob and calls `navigator.share({ files: [png], text })`; fallback = download the image / copy text (existing fallback path).

**Risk / fallback:** compositing tiles inside `ImageResponse` (Satori) is the fragile part. If it fights us, ship stats + duration + a photo first and add the map in a follow-up — flag it, do not silently drop the map.

**Rejected approaches:**
- Client DOM-to-image: cross-origin CARTO tiles + auth-gated photos taint the canvas → export throws.
- Public unfurl page: sessions are private; would leak them.

## D. `CLAUDE.md` invariant update (product decision: "middle ground")

Amend "Celebrate variety, never volume" to carve out that a **user-initiated session share card may show that session's drink count**. Keep **pace / avg-per-hour fully PARKED**. Record the date + that it was a deliberate call.

## E. Testing / verification

- `docker exec birava-app npx tsc --noEmit`.
- Manual drive at phone width: header shows only bell; Crews shows Find people; session share generates an image and opens the share sheet.
- Auth/ownership check on the share-image route (a non-owner / logged-out request must not get another user's card).
