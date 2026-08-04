# Backend architecture

A living map of Birava's backend. **Keep this updated** whenever a new layer, route, or cross-cutting flow is added or an existing one is restructured — treat a diagram that no longer matches the code as a bug, not just stale docs.

## Layered request flow

Every request enters through either a Route Handler (`app/api/**`) or a Server Action (`lib/controllers/*.ts`, all `"use server"`), and both funnel down through the same domain layer. Neither layer talks to Prisma directly.

```mermaid
flowchart TB
    subgraph Client["Client (PWA)"]
        UI["React components<br/>(Server + Client Components)"]
        Offline["Offline queue<br/>lib/offline/*"]
    end

    subgraph Edge["middleware.ts — Node runtime"]
        MW["Session gate<br/>lib/auth/proxy-session.ts"]
    end

    UI -->|fetch| Routes
    UI -->|direct function call| Actions
    Offline -->|sync on reconnect/visible| Actions
    UI --> MW
    MW -->|"x-birava-session-user header<br/>(read by getCurrentUser)"| Routes
    MW -->|"x-birava-session-user header"| Actions

    subgraph Routes["Route Handlers — app/api/**/route.ts"]
        direction TB
        R1["auth/*, signup — no auth check (that's the point)"]
        R2["uploads/* — photo/avatar direct-upload + plain upload"]
        R3["photos/*, avatars/* — auth-gated blob proxy"]
        R4["sessions/[id]/share-image — recap image"]
        R5["cron/* — CRON_SECRET bearer auth, not user session"]
    end

    subgraph Actions["Server Actions — lib/controllers/*.ts"]
        direction TB
        A1[drinkController]
        A2[groupController]
        A3[socialController]
        A4[notificationController]
        A5[profileController]
    end

    subgraph Domain["Domain layer"]
        direction TB
        Commands["Commands — lib/commands/*<br/>writes + multi-step orchestration"]
        Queries["Queries — lib/queries/*<br/>reads"]
        Mappers["Mappers — lib/mappers/*<br/>Prisma row → DTO (lib/dtos/*)"]
        Render["Render — lib/render/*<br/>Satori/ImageResponse, pure"]
    end

    subgraph Infra["Infrastructure"]
        direction TB
        PhotoModule["modules/photo-upload<br/>self-contained DI module"]
        PushLib["lib/push/*<br/>web-push"]
        DB[("PostgreSQL via Prisma<br/>lib/db.ts")]
        Blob[("Vercel Blob (prod/staging)<br/>Local disk (dev)")]
    end

    Routes --> Commands
    Routes --> Queries
    Routes --> Render
    Actions --> Commands
    Actions --> Queries
    Commands --> Mappers
    Queries --> Mappers
    Commands --> DB
    Queries --> DB
    Commands --> PhotoModule
    Commands --> PushLib
    PhotoModule --> Blob
    Render --> Routes

    subgraph Scheduled["Scheduled jobs"]
        GHA["GitHub Actions<br/>.github/workflows/*.yml"]
    end
    GHA -->|"Bearer CRON_SECRET"| R5
```

**Why two entry points (Routes vs. Actions) instead of one:** Server Actions are the primary path for anything a logged-in client component calls directly (mutations, most reads) — they get Next's built-in CSRF protection and don't need a hand-rolled fetch. Route Handlers exist for what Server Actions can't do: endpoints that need a specific HTTP method/response shape (image bytes, direct-upload tokens), that Content-Type: multipart/JSON bodies (photo uploads), or that are invoked by something other than this app's own client (GitHub Actions cron pings, the browser's own direct-to-Blob PUT).

## Offline support (service worker)

`public/sw.js` maintains two separate caches: a static-asset cache (`_next/static`, icons, the manifest — content-hashed, safe to serve cache-first forever) and a **navigation cache** keyed by URL, holding the last successfully-rendered HTML for each page the user has actually visited. Navigations are always network-first — a page never goes stale while online — and only fall back to the cache when the fetch itself fails (no connection).

```mermaid
flowchart TD
    Nav["Browser navigation<br/>(open app, reload, back/forward)"] --> Fetch{"fetch() the network"}
    Fetch -->|succeeds| Store["Cache the response<br/>(nav cache, keyed by URL)"] --> Render["Render fresh page"]
    Fetch -->|fails — no connection| Lookup{"Cached copy of<br/>this exact URL?"}
    Lookup -->|yes| Stale["Serve last-cached HTML<br/>+ OfflineBanner shows"]
    Lookup -->|no — never visited| Offline["Serve /offline<br/>(precached at SW install,<br/>excluded from the auth<br/>redirect in proxy-session.ts)"]
```

This is why a **returning, already-authenticated** user can open every page they've previously visited with no connection at all — each one plays back exactly as it last rendered, server data included, with `components/offline-banner.tsx` making clear it isn't live. A page that was **never** opened before falls through to `/offline`, which is why that route has to render for a logged-out request too — the middleware auth gate (`lib/auth/proxy-session.ts`) explicitly carves it out, alongside `/login`/`/signup`.

**What this does not solve:** a genuinely first-time visitor — nothing installed, nothing cached, no account yet — still needs at least one successful round trip to sign up; there's no offline-capable identity system. The offline story here is "resume where you left off with no signal," not "onboard a brand-new user with zero connectivity ever." The **check-in itself** is the one action that's fully offline-safe regardless: `lib/offline/pendingCheckins.ts` queues it in IndexedDB the instant "Log drink" is tapped, synced later by `PendingCheckinsSync` (foreground-only — WebKit has no Background Sync API).

The nav cache is cleared on sign-out (the SW watches for a successful `POST /api/auth/logout` and drops it) so the next person to open the app offline on a shared device lands on the login screen, not the previous user's last-cached page.

## Direct-to-Blob upload flow

The one flow worth its own diagram — it's non-obvious because the server is only involved at the *start* and *end*, not during the actual transfer.

```mermaid
sequenceDiagram
    participant Browser
    participant TokenRoute as blob-token route
    participant Blob as Vercel Blob
    participant FinalizeRoute as finalize route
    participant Command as commands/* + PhotoUploadService

    Browser->>TokenRoute: POST (validate pathname belongs to caller)
    TokenRoute-->>Browser: scoped upload token
    Browser->>Blob: PUT raw file bytes directly (bypasses serverless body limit)
    Blob-->>Browser: raw blob URL
    Browser->>FinalizeRoute: POST { url: rawUrl }
    FinalizeRoute->>Command: finalizeDirectUpload(rawUrl, ownerId)
    Command->>Blob: fetch raw bytes back, process (resize/re-encode/strip EXIF)
    Command->>Blob: store final blob, delete raw blob
    Command-->>FinalizeRoute: { url, lqip }
    FinalizeRoute-->>Browser: { url, lqip }
    Note over Browser,Command: DB write (addDrink / updateProfileAvatar) happens<br/>as a SEPARATE later step — see docs/architecture.md's<br/>"orphaned blob" note below.
```

**The gap this leaves, and how it's closed:** a blob can exist in storage with zero DB rows referencing it — if the form is abandoned after upload but before submit, or a tab is killed mid-flow. Closed in layers: client-side best-effort cleanup (`components/drink/log-drink-form.tsx`'s unmount/`pagehide` handlers), the offline queue persisting an uploaded URL immediately so retries don't re-upload, and a **daily reconciliation cron** (`lib/commands/photoCleanupCommands.ts`, scheduled via GitHub Actions) as the actual guarantee — it deletes anything unreferenced past a 7-day grace period, bounded to 200 delete attempts/run so a large backlog can't exceed the function's time budget.

## Scheduled jobs

Every recurring job runs the same way: a GitHub Actions workflow on a cron schedule `curl`s a `CRON_SECRET`-guarded route. Nothing uses `vercel.json`'s native cron (Vercel Hobby's once-daily limit made that a dead end for sub-daily jobs, and everything was consolidated onto one platform afterward for consistency).

| Job | Workflow | Route | Cadence |
|---|---|---|---|
| Session reminders | `session-reminders.yml` | `/api/cron/session-reminders` | every 15 min |
| Orphaned blob cleanup | `cleanup-orphaned-blobs.yml` | `/api/cron/cleanup-orphaned-blobs` | daily |

## Key boundaries to preserve

- **Prisma models never cross the `lib/queries` / `lib/commands` boundary un-mapped.** Every query/command returns a `lib/dtos/*` class (see `lib/mappers/*` for the conversion), not a raw Prisma row — the one intentional, documented exception is `lib/controllers/drinkController.ts`'s read functions, which still return the legacy `DrinkEntry`/`DrinkSession` shape (`lib/types.ts`/`lib/sessions.ts`) the session-grouping engine is built on.
- **DTOs are `export class X { declare field?: type }`**, not interfaces or inline types — see any file under `lib/dtos/`.
- **`modules/photo-upload/` has zero imports of anything Birava-specific** — it's a portable, constructor-injected module (interfaces, factories, C#-style OOP). App-specific composition happens in `lib/photoUpload.ts`/`lib/avatarPhoto.ts` (the composition roots), not inside the module.
- **No `any`/`unknown`/unsafe casts/non-null assertions in application code.** Where a boundary is genuinely opaque (a vendor SDK's private wire format, parsed JSON before validation), the type used is an honest one (e.g. `modules/photo-upload/Models.ts`'s `Json` type) with a runtime check or a narrowly-scoped, commented exception — never a silent `unknown`/`any`.
