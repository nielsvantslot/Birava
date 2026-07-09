# Birava — Product & UX Audit

**Date:** 2026-07-09
**Commit audited:** `b57377a` ("Removal of Supabase and backend switch") **plus the uncommitted `feature/frontend-redesign` working tree** (~1,370 changed lines — the redesign is what was audited, not the commit).
**How explored:** Full static read of every route, component, action, schema, manifest and service worker; then run live via `docker compose` and clicked through every screen twice — once as the seeded `designtest` account (filled states), once as a freshly created account (empty states). Logged a beer, joined with a wrong crew code, opened crew detail, tested search/follow, inspected the browser console. Local timezone during testing: CEST (UTC+2); the container runs UTC — this mattered (see 🔴-2/3).

---

## 1. Step 0 — Concept reconstruction (before rereading the brief)

*From the app alone:* Birava is Strava for beer — you check in beers (photo, style, star rating, venue, GPS), and the app rolls each day's check-ins into a "session" card with Strava-style stats (beers, venues, duration, top rating) and a route map. You follow friends and see their check-ins in a feed, keep a daily streak with a training-calendar view, and compete on all-time beer count in small invite-code groups. You'd open it a second time to keep the streak alive and to see whether your friends are beating your total.

### Mismatches against the stated intent — each one is a finding

| # | Intent | What the app actually communicates |
|---|--------|-------------------------------------|
| M1 | Sessions are "an evening out, like a Strava activity" | A session is a **calendar day in server time**. It's never explained, never closes, and a night out that crosses midnight becomes two sessions. I could not infer the intended mechanic from the app — I inferred "day bucket," because that's what it is (`lib/sessions.ts:30-42`). |
| M2 | "Crews" compete via invite codes | Half the app calls them crews, the other half calls them **groups** and a third surface calls the screen **Board**. The join-error literally says "Group not found" inside the Crews screen. |
| M3 | One token system, one accent, honey for achievements only | Only six screens follow it. Five screens (`/history`, `/leaderboard`, `/leaderboard/[id]`, `/people`, `/profile/[username]`) are a visibly different app: emoji headers, orange remnants, shadcn cards, `--primary` everywhere. |
| M4 | Deadpan athletic voice | New screens have it ("Thirty seconds. Then back to drinking it."). Legacy screens are jokey party-app copy ("10 beers down!", "you're unstoppable!", "Board 🏆"). |
| M5 | Bottom nav identical on every screen | The component is identical, but the **active state is wrong or missing on five routes**, which reads as "the nav changed." |
| M6 | Streaks/achievements as mock-serious training | Streak math is broken (three divergent implementations, one hardcoded to 0), so the flagship mechanic mostly displays wrong numbers. |
| M7 | "Local Legend at a venue" as an achievement | It exists only as a callout on your newest session card. It's not in the achievements list, is never explained, and appears on sessions that have no venue at all. |

---

## 2. Findings

### 🔴 Breaks comprehension or trust

**🔴-1. The app is two different apps stitched together.**
- **Where:** New system: `dashboard`, `feed`, `log`, `crews`, `stats`, `profile` (own). Legacy system: `history`, `leaderboard`, `leaderboard/[groupId]`, `people`, `profile/[username]`, plus `add-beer-dialog.tsx`, `beer-card.tsx`, all `board-groups-client`/`leaderboard-client`/`group-*` components.
- **Why it matters:** A user taps "Sessions" in the profile tab strip and lands on "History 📋" — different name, different design language, different date format (`en-US` vs `en-GB` elsewhere), browser `confirm()` dialogs. It reads as leaving the app. Worse, **Crews and Board are the same feature twice**: `/crews` has Start-a-crew + Join-with-a-code, and `/leaderboard` ("Board 🏆") has Create-a-Group + Join-a-Group — both writing to the same tables with different words and different error copy.
- **Fix:** Kill `/leaderboard` as a standalone screen. Crew detail becomes `/crews/[id]` in the new design. Fold History into `/stats` (it's already linked there as "Sessions"). Rebuild the public profile and People in the token system. Delete `board-groups-client.tsx`, `add-beer-dialog.tsx` (see 🟡-8 for the edit-flow it currently owns), `stat-card.tsx`, `group-activity-feed.tsx`.

**🔴-2. History is actually broken: hydration error leaves all entries invisible.**
- **Where:** `/history` → `components/beer/beer-card.tsx` + `lib/utils.ts:formatDate`. Confirmed live: day headers render, every card is blank; console shows `Hydration failed… "Jul 9, 2026, 10:19 AM" vs "Jul 9, 2026, 8:19 AM"`.
- **Why:** `formatDate` runs on the server in container time (UTC) and again on the client in local time. The mismatch throws, React regenerates the tree, and the framer-motion cards (`initial={{opacity: 0}}`) end up stuck invisible. Every user not in UTC sees an empty history that claims "All 21 beers logged."
- **Fix:** Format dates in a client component from the ISO string (or render a `<time dateTime>` and hydrate the label client-side). Remove the `initial` opacity animation from server-listed cards.

**🔴-3. All "day" math runs in server timezone — sessions, streaks, "today" are wrong for everyone outside UTC.**
- **Where:** `lib/sessions.ts:30` (`dayKey` uses server-local `Date`), `getStreak` in `app/(app)/log/page.tsx`, `profile/page.tsx`, `profile/[username]/page.tsx`, `getStreakDays` in `stats/page.tsx`, `buildLeaderboard`'s "Today" column, `formatWhoDate` in `dashboard/page.tsx`.
- **Why:** Confirmed live: a beer logged at 10:19 local renders as "9 July 2026 at 08:19 · **Morning Session**". A beer at 01:00 on a Saturday night counts toward Sunday's session and can silently break a streak. In production (Vercel = UTC) every Dutch user's day flips at 02:00, not midnight.
- **Fix:** Decide day-bucketing in the *user's* timezone. Simplest robust option: capture the client's `Intl.DateTimeFormat().resolvedOptions().timeZone` (or a local `logged_on_date` string) at log time and store it on the entry; compute sessions/streaks off that.

**🔴-4. Streak logic is wrong, duplicated four times, and contradicts itself on screen.**
- **Where:** Four implementations: `log/page.tsx:8`, `profile/page.tsx:9`, `profile/[username]/page.tsx:19`, `stats/page.tsx:23`; plus `getPublicProfile` in `lib/actions/social.ts:109` which hardcodes `streak_days: 0`.
- **Why, seen live:** With 5 consecutive logged days ending yesterday, Stats says "Your streak **0**d / Streak check-ins **0**" (streak dies at 00:00, before the day is even over) and the log toast then says "Logged. Streak: **1** days" — wrong number *and* wrong plural — while Profile says **6**d after the same log. The flagship mechanic displays three different numbers in one minute of use.
- **Fix:** One `getStreak(entries, tz)` in `lib/`, counting back from *today or yesterday* (a streak isn't broken until a full day is missed). Toast reads "Logged. Streak: 6 days" / "1 day". Delete the other copies.

**🔴-5. The social buttons are fake.**
- **Where:** `components/beer/social-row.tsx` — "🍺 Proost" shows a toast ("Proost! 🍺") and saves nothing; "💬 Comment" toasts "Comments — soon"; the "···" menu on session cards (`dashboard/page.tsx:141`) is a plain div that does nothing.
- **Why:** A user proosts a friend's night and believes they sent something; the friend never sees it. That is a trust break, not a stub. Dead "···" affordances teach users the UI doesn't respond.
- **Fix:** Either persist proosts (one small `Kudos` table, counts on the social row — this is *the* Strava retention mechanic and cheap to build) or remove the buttons. Don't ship the middle. Remove "···" until it has a menu.

**🔴-6. Crew leaderboards rank all-time personal totals, not the crew's trip.**
- **Where:** `crews/page.tsx:35-51` and `leaderboard/[groupId]/page.tsx:110-123` — both sum **every beer the member ever logged**; `beer_entries.group_id` exists in the schema but is never written (the log form doesn't send it; `addBeer` receives no group).
- **Why:** Join a colleague's weekend crew and your 400-beer lifetime history instantly "wins" their trip. "Plan the trip, set the challenge, keep score" (the Crews copy) is not what the screen does. This makes crews pointless as competitions.
- **Fix:** Scope the count to entries created after `joined_at` (works with today's schema, one `where` clause), and show "since you joined" under the number. Longer term: crews get a start/end date and the board counts that window.

**🔴-7. Public profile shows a wrong "Total".**
- **Where:** `profile/[username]/page.tsx:90-100` — fetches `take: 20` entries, then labels `entries.reduce(...)` as "Total 🍺" and feeds it to `getEarnedAchievements`.
- **Why:** Anyone with >20 entries has their total, streak, average and achievement badges silently understated. Numbers that are visibly wrong to the profile owner destroy trust in every other number in the app.
- **Fix:** Use an aggregate query for the total (as `getPublicProfile` already does) and compute achievements from it; keep `take: 20` only for the visible "Recent beers" list.

**🔴-8. Password-reset link is handed to any caller — account takeover.**
- **Where:** `app/api/auth/forgot-password/route.ts:34-38` returns `resetUrl` in the JSON response ("in local/dev we return the reset link…") with **no environment guard**; the page even renders it (`debugResetUrl`).
- **Why:** In production, anyone can POST a victim's email and receive a working reset link. This is not a UX finding, but it ships with the current tree, so it goes above the fold.
- **Fix:** Gate on `process.env.NODE_ENV !== "production"` at minimum; correct fix is emailing the link and returning only `{success:true}` unconditionally.

**🔴-9. Photo uploads will not survive production, and take anything.**
- **Where:** `lib/storage/local.ts` writes to `public/uploads/` on the app's own filesystem; `vercel.json` says the target is Vercel, whose function filesystem is ephemeral/read-only. `app/api/uploads/beer-photo/route.ts` has **no size or MIME validation**.
- **Why:** On Vercel, photo upload 500s or the file vanishes on next deploy. Locally, a 2 GB `.exe` is accepted and served back from `/uploads/`. Also `next.config.ts` sets no `images` config and every consumer uses raw `<img>` with the original file — a 12 MB phone photo is shipped as-is to friends on bar Wi-Fi.
- **Fix:** Move to object storage (S3/R2/Vercel Blob). Validate `file.type.startsWith("image/")` and cap at ~10 MB. Resize/compress server-side (sharp) or client-side before upload.

### 🟡 Causes friction or dilutes the concept

**🟡-1. Vocabulary drift — the full inventory.** One concept, many names, with file references:

| Concept | Names in the UI | Where |
|---|---|---|
| A crew | "Crews" (nav, `bottom-nav.tsx:52`), "crew" (`crews/page.tsx`, `crews-forms.tsx`), "Group" ("Group not found" `lib/actions/groups.ts:47`; "Create a Group", "Join a Group", "Delete Group", "Leave Group", "owner" badge in `board-groups-client.tsx` / `group-leaderboard-client.tsx`), "Board" (`leaderboard/page.tsx:38`), "Leaderboards" (header title `app-header.tsx:21`, crews tab strip) | everywhere |
| A check-in | "Log a beer" (nav/log), "check-ins" (Local Legend callout, stats label "Streak check-ins"), "Add a Beer 🍺" (`add-beer-dialog.tsx:220`), "entry" (delete confirm "Delete this beer entry?"), "beers" (history) | everywhere |
| A session | "session" (dashboard cards, stats chip), "History 📋" (the screen that lists what sessions are made of), "Sessions" (tab strips on stats + profile → but it links to History), also `Session` is the *auth* table in `prisma/schema.prisma:27` | everywhere |
| The feed(s) | "Home"/"Following" (dashboard), "Feed" (feed), "Recent Activity" (`group-activity-feed.tsx`) | 3 screens |
| People | "You" (nav), "Profile" (header on others' profiles), "People 🤝" (page h1), "Find Friends" (header title + button + menu item "Find friends" lowercase) | `people/page.tsx`, `app-header.tsx` |

**Fix:** Pick the five nouns/verbs (log, check-in, session, crew, leaderboard) and grep the rest out of existence. The join error becomes "That code doesn't match any crew."

**🟡-2. Home and Feed are one feature split across two tabs.**
- **Where:** `dashboard/page.tsx` and `feed/page.tsx` query the *same* rows (you + people you follow, newest first); one groups into session cards, the other lists raw check-ins with the identical SocialRow beneath.
- **Why:** New users see the same beer twice under two different tabs and can't form a model of which screen is "the" social surface. It also duplicates the "Find Friends" entry point (Feed header chip + empty-state button + settings menu).
- **Fix:** One social tab. Sessions are the unit (that's the concept); a session card can expand to its check-ins. Feed's slot in the nav goes to… nothing — a 5-tab nav (Home, Stats, Log, Crews, You) carves the app correctly.

**🟡-3. Bottom-nav active states lie.**
- **Where:** `bottom-nav.tsx:81` (`pathname.startsWith(href + "/")`). Live: `/history`, `/leaderboard`, `/leaderboard/[id]`, `/people` highlight **nothing**; `/profile/niels_hop` (someone else!) highlights **"You"**.
- **Why:** The brief's one hard rule about the nav ("identical on every screen") is kept by the component but broken by the states — five screens exist outside the nav's world model.
- **Fix:** Falls out of 🟡-2/🔴-1 (those routes move under nav-owned parents). For `/profile/[username]`, stop matching "You".

**🟡-4. The tab strips are navigation cosplaying as tabs.**
- **Where:** `screen-tabs.tsx` used with different sets per screen: Home `Following/You/Nearby`, Stats `Progress/Records/Sessions`, Crews `Active/Leaderboards/Discover`, Profile `Profile/Progress/Sessions`.
- **Why:** Three of the ten "tabs" are dead ("— soon" toasts: Nearby, Records, Discover); "Sessions" and "Leaderboards" teleport you to legacy screens; "Progress" on the Profile strip goes to the same place as the Stats nav tab. Tabs that navigate away from their own screen break the back-button expectation and make the hierarchy unlearnable.
- **Fix:** Tab strips only switch content *within* the screen (Following/You is the one correct usage — keep it). Cut the dead tabs entirely; "soon" belongs on a roadmap, not in primary navigation.

**🟡-5. Offline logging simply fails — and this is a bar app.**
- **Where:** `public/sw.js` skips non-GET and navigation requests entirely; `addBeer` is a server action with no queue/retry; failure surfaces as "Failed to save beer."
- **Why:** The single most likely context (basement bar, festival field, roaming abroad on the "holiday" this app is named for) breaks the core loop. The PWA shell also doesn't load offline at all (no cached routes → browser dinosaur).
- **Fix (staged):** (1) Keep form state on failure + explicit "Couldn't reach the server — retry" button. (2) Queue failed logs in IndexedDB and flush on `online`/Background Sync, with an "syncing 2 check-ins…" pill. (3) Cache an app shell for navigations. Step 2 is the one that matters.

**🟡-6. Session semantics undermine the "evening out" concept.**
- **Where:** `lib/sessions.ts` — bucket = user × calendar day; title from the *first* check-in's hour (`sessionTitle`).
- **Why:** A night from 21:00–01:30 is split into "Evening Session" + a separate "Night Session" (the next day's bucket), duplicating cards and breaking Duration. A single 17:59 beer titles the whole evening "Afternoon Session". A lone lunch beer becomes a "session" with Duration "—", which makes the concept look broken on day one.
- **Fix:** Gap-based sessionization: a check-in within N hours (e.g. 4) of the previous one extends the session, else starts a new one. Title from the session's *midpoint* hour. One-beer sessions render as a slimmer "check-in" card without Duration/Venues stats.

**🟡-7. Two different logging forms exist, and the edit form is the wrong one.**
- **Where:** Create = `log-beer-form.tsx` (name, photo, style chips, rating, venue, amount). Edit = legacy `add-beer-dialog.tsx` via History (name, brewery, style *dropdown with 15 different options*, amount `0.5–10` decimal, notes, datetime, photo) — no rating, no venue.
- **Why:** Fields the user set at create time (rating, venue, location) are invisible and uneditable when editing; `brewery`/`notes` are editable but never *creatable*. The style lists don't even match ("Wheat" vs "Wheat Beer", "Hefeweizen"…). Amount is integer chips in one place, decimal input in the other.
- **Fix:** One form component for create + edit (the new one, plus a collapsed "more" section for notes/time). One canonical style list in one constant.

**🟡-8. Empty/first-run experience stops after the dashboard.**
- **Where:** Dashboard empty state is good ("No sessions yet → Log a beer"). But empty Stats renders a full zeroed 12-week chart with a giant accent "View progress details" button leading to an empty History; Feed's empty state has *two* Find-Friends buttons on one screen; nothing anywhere explains sessions, streaks, or what a crew code is.
- **Why:** The 10-second test passes on Home and fails everywhere else; the app assumes Strava literacy for its three invented mechanics (session, streak, Local Legend).
- **Fix:** Empty Stats: replace chart + CTA with one line ("Stats appear after your first session."). One-time explainer line under first session card ("Check-ins on the same night group into a session"). Streak stat gets a sublabel ("days in a row with a session"). Crews empty state already explains itself — good.
- Also: `people-client.tsx` `autoFocus` pops the keyboard over the results the instant the screen opens — remove.

**🟡-9. Accent discipline slips where it matters most (the token system's one rule).**
- **Where:** Feed renders **other people's** usernames and ratings in accent (`feed/page.tsx:46,64`); "View progress details" (`stats/page.tsx:259`) is a full primary button that merely navigates; legacy screens use `--primary` for other users' totals (`leaderboard-client.tsx:86`), borders, icons — i.e. accent as decoration throughout.
- **Why:** "Accent = actions + your own data" is the sharpest idea in the system; the feed dilutes it to "accent = links".
- **Fix:** Others' identities in `--ink`; ratings in `--ink-dim`; "View progress details" becomes an `h-row` text link like every other "See all".

**🟡-10. Honey leaks / accent leaks into celebration.**
- **Where:** Confetti fires in the *old orange* palette (`lib/achievements.ts:15`: `#f97316, #fb923c…`); legacy achievement badges use `--primary` not `--honey` (`profile/[username]/page.tsx:206-215`); auth screens have an orange glow under a green logo (`shadow-orange-500/30`, `login/page.tsx:48`, `signup/page.tsx:73`).
- **Fix:** Confetti colors → `#E8C15A` family; achievements → honey everywhere; delete the orange shadow.

**🟡-11. Voice drift, quoted.**
Deadpan-athletic (keep): "Thirty seconds. Then back to drinking it." · "Plan the trip, set the challenge, keep score." · rating captions "skip it … seek it out" · "Most check-ins in the last 90 days".
Off-voice (kill): "10 beers down!" · "50 beers legend!" · "100 beers - you're unstoppable!" (`lib/types.ts:50-79`) · "Board 🏆", "People 🤝", "History 📋", "Profile 👤" emoji headers · "Be the first to log a beer!" · "Find your friends 🤝". Mixed English/Dutch: "Proost" as the kudos verb is a good brand move — but then *commit* (button, toast, and share copy all use it; "Comment" stays English next to it). Capitalization: "Find Friends" vs "Find friends" vs "member since" — pick sentence case.
Date locales: `en-GB` on dashboard/feed vs `en-US` on history/profiles (`lib/utils.ts:9`) — one locale.

**🟡-12. PWA/manifest is from the previous app.**
- **Where:** `public/manifest.json`: `theme_color: "#f97316"` (orange) vs the app's `#0A0D09`, `background_color: "#0f0f0f"`, description "Track your holiday beers". No `icons.apple` in `app/layout.tsx` metadata → iOS home-screen icon falls back to a screenshot. `statusBarStyle: "black-translucent"` but no `padding-top: env(safe-area-inset-top)` on the sticky header → in iOS standalone the clock overlaps the "Home" title. `userScalable: false, maximumScale: 1` blocks zoom (accessibility, and iOS ignores it anyway).
- **Fix:** theme/background → `#0A0D09`; add `appleTouchIcon`; add safe-area top padding on `.header`; drop the zoom lock. Rewrite manifest description to current positioning.

**🟡-13. Legacy interaction leftovers feel broken inside a PWA.**
- **Where:** `confirm()`/`alert()` in `beer-card.tsx:28`, `group-leaderboard-client.tsx:33,45`, `board-groups-client.tsx:34,49`.
- **Why:** System dialogs in standalone mode look like crashes and can't be styled; error alerts ("Could not create the group.") also swallow the real error message.
- **Fix:** Toast-pill for errors, small confirm sheet for destructive actions (there's already a Dialog component).

**🟡-14. Small-target audit.** Header icons are 34px (`.hicon`), legacy icon buttons 32px (`h-8`), the "···" menu ~20px text. The brief's 44px floor is only met by the nav and the big buttons. Fix: bump `.hicon` to 44px hit area (padding, not glyph size), same for legacy rows you keep.

**🟡-15. Leaderboard poller.** `leaderboard-client.tsx:129` runs `router.refresh()` every 30 s forever, plus on focus/visibility/pageshow. On a phone at a festival that's a battery/data leak for a screen that changes a few times a night. Fix: refresh on focus only.

### 🔵 Polish

- **🔵-1.** `SessionMap` uses `className="map"` but no `.map` rule exists in `globals.css` — the map renders on browser default SVG sizing; add the intended rule (width 100%, radius 0, display block). (`session-map.tsx:82`)
- **🔵-2.** Hardcoded colors outside tokens: `#151A21` ×4 in `session-map.tsx` (tile-gap color, should be a `--map-bg` token or `--surface-2`), confetti hexes (see 🟡-10), `rgba(10,13,9,.55)` photo-overlay and `rgba(147,141,126,0.4)` muted-day in CSS (fine as derived values, but note them in the token file), `#e5484d` destructive (tokenized, OK).
- **🔵-3.** Stat grammar strays: History's day badge "4 🍺" pill and public-profile "Total 🍺 / Streak 🔥 / Avg/day 📊" cards break label-over-numeral; leaderboard rows put the numeral right-aligned with unit *below* — retokenize when 🔴-1 lands.
- **🔵-4.** "Birava App" hardcoded in every session meta line (`dashboard/page.tsx:137`) — Strava says "Mobile App" because there are several sources; here it's noise. Show venue (already appended) or nothing.
- **🔵-5.** The `.section` "Beer session" chip on Stats (`stats/page.tsx:215`) looks like a sport-picker control but is inert decoration — cut it or make it real when a second "sport" (cider?) exists.
- **🔵-6.** `README.md` documents the previous two generations (Supabase schema, next-pwa, FAB/TopBar components, Next 15, "MIT – have fun and drink irresponsibly 🍺"). Rewrite after the redesign lands; the last line is exactly the sentence an app-store reviewer should never find.
- **🔵-7.** Dead route `/groups` (redirect only, nothing links to it) — delete. `recharts` is in `package.json` but no longer imported anywhere — drop the dep. `stats-charts.tsx`, `top-bar.tsx`, `add-beer-fab.tsx`, `last-24h-recap.tsx` already deleted — good, finish the job (`feed-photo-download.tsx` is also orphaned; only legacy screens import `stat-card.tsx`… verify and delete).
- **🔵-8.** Nominatim reverse-geocoding straight from the client (`log-beer-form.tsx:28`) violates their usage policy at any scale (needs identifying UA/referer, 1 req/s) — proxy it through your API or switch provider before launch.
- **🔵-9.** Session detail: photos +N overlay counts only >4, `spanFirst` full-width lead photo is a nice touch — but tapping photos does nothing on new screens (legacy history had a lightbox). Add tap-to-view.
- **🔵-10.** `generateInviteCode()` = `Math.random().toString(36)` can emit ambiguous chars (0/O, 1/I/L) that people will misread over bar noise — restrict alphabet to `23456789ABCDEFGHJKMNPQRSTUVWXYZ`.
- **🔵-11.** Duplicate log entry points (header ⊕ *and* nav Log *and* dashboard CTA) are fine — but the header ⊕ appears *on the Log screen itself*, linking to where you already are.
- **🔵-12.** `dashboard` fetches 120 entries + all follows on every visit and sessions are recomputed per request; fine for now, but sessions-as-derived-data will collide with 🟡-6 — consider materializing sessions when you fix the semantics.

---

## 3. Step 6 — The uncomfortable questions, answered directly

**Streaks reward daily drinking. Where does it cross the line?**
It crosses it in three specific places today: (1) the **streak calendar** on Stats paints a green ring for every day you drank and a hollow ring on today — a literal "drink today to stay green" prompt; (2) the **log toast** attaches the streak to the act of drinking ("Logged. Streak: N days") — reinforcement at the exact moment of consumption; (3) the **hollow "0d" the morning after** a 5-day run (the streak-dies-at-midnight bug makes this worse, but even fixed, a daily-consecutive-drinking counter is the mechanic). This is a genuine hazard for users, for app-store review, and for the brand's mock-athletic joke — the joke only works if the app plainly *isn't* coaching you to drink.

Concrete mechanics that keep the game and drop the hazard:
- **Redefine the streak unit as weeks, not days:** "Active weeks" — a week counts if it contains ≥1 logged session. Athletes don't train daily; the deadpan frame gets *stronger* ("4 active weeks. Consistency.").
- **Rest-day framing in the calendar:** non-drinking days between sessions render as quiet "recovery" dots, not failures. Copy: "Rest day. The liver is a muscle too." — that's the voice the brief wants, doing safety work.
- **Cap the counter inside a session:** after N beers in one session, the stat line stops incrementing publicly ("6+") even if the log keeps recording. The data stays honest; the *celebration* stops scaling with volume.
- **Remove streak from the log toast** entirely; confirm the check-in ("Logged. Tsingtao, ★4."), keep streaks on Stats where reflection lives.

**Where does the app celebrate volume that should celebrate something else?**
Almost everywhere a number is big: the achievement ladder is *purely* volumetric (1/10/50/100 with "Beer Marathon"), crew leaderboards rank lifetime total, the public profile shows **"Avg/day 3.0 📊"** — an average-daily-alcohol figure presented as a trophy stat (this one should simply be deleted), and the share string is "X beers total". Meanwhile the app already collects the *right* raw material and ignores it: styles, venues, breweries, ratings, photos. Replace the ladder with variety/discovery achievements (Style Collector: 5 styles; Cartographer: 10 venues; Local Legend graduating into a real, explained achievement; Critic: 25 written ratings), and let crew boards rank *sessions logged* or *venues explored* during the trip rather than raw count. Keep "beers" as a stat — it's the sport's distance metric — but stop making it the only thing with a medal.

**What is the retention story, honestly?**
Today: streak guilt + a rigged lifetime leaderboard + fake social buttons — that's not a strategy, it's three findings (🔴-4, 🔴-6, 🔴-5). The honest retention assets this concept actually has: (1) **crews during trips** — a time-boxed event where the board resets and everyone's phone is already out; (2) **the session recap card** — genuinely nice, shareable, and the reason to log *tonight*; (3) **Local Legend** — venue identity is the one mechanic with a real-world hook (you go back to "your" bar); (4) **the yearly/monthly recap** (the Share string on Stats is the seed). All four are event- and identity-based, none require daily consumption. Build the loop as: log tonight → recap card tomorrow → crew board during trips → recap at the end — and let streaks be a quiet secondary stat, not the engine.

---

## 4. The five things to do first

1. **Fix the numbers users see first** — one timezone-aware `getStreak`, correct toast copy, real public-profile totals, and the History hydration/date fix (🔴-2/3/4/7). Every mechanic downstream depends on these numbers being believed.
2. **Collapse the two apps into one** — kill Board/History/People/public-profile as legacy surfaces, move crew detail under `/crews/[id]`, one logging/edit form, one vocabulary (crew, check-in, session) (🔴-1, 🟡-1/-7).
3. **Make crews scoreable** — count only beers since `joined_at` (one where-clause now, trip windows later) (🔴-6). This turns the social feature from rigged to playable.
4. **Make Proost real or remove it** (🔴-5) — a `Kudos` table and a count is a day's work and it's the retention loop.
5. **Defuse the streak** — weeks-active unit, rest-day framing, streak out of the log toast, delete "Avg/day" from public profiles (Step 6). Do this before anyone outside the crew of friends sees the app.

*(Not UX but do not deploy without: gate the forgot-password `resetUrl` (🔴-8) and move uploads off local disk with size/type validation (🔴-9).)*

---

## 5. What's already working — don't touch it

- **The token system itself** (`globals.css`) is genuinely good: the flat label-over-numeral stat grammar, edge-to-edge sections with bg gaps, serif act-titles, the honey-only callout — the six redesigned screens look like one confident product. The Local Legend callout styling is exactly the right quiet register.
- **The log flow** is the best screen in the app: one tap with sane defaults (IPA/★4/×1), smart silent geolocation with venue prefill that respects user-typed input, rating captions in perfect voice, integer amount chips. Live-tested at literally one interaction. Keep it sacred.
- **The session card anatomy** (who/meta → serif title → stat row → photos → map → social row) is a faithful, well-executed Strava transplant, and the server-rendered SVG map with CARTO dark tiles + accent route is a clever, dependency-free solution that matches the design.
- **Dashboard/Feed/Crews empty states** say what to do in one sentence with one CTA.
- **The bottom nav component** (single source, 6 items, accent active state) and the header grammar are right; only the active-state matching needs the fix above.
- **Infrastructure choices from the migration** are solid: direct Prisma with mappers, `getCurrentUser()` as the single auth entry, sensible schema (indexes, cascades, `group_id` already on entries — ready for 🔴-6), dev-only SW registration with cache cleanup, fonts via `next/font`.
- **Voice, when it's the new voice** — "Thirty seconds. Then back to drinking it." is the whole brand in eight words. The job is to make the rest of the app sound like that line.
