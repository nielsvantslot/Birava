# Birava v3: from bootstrap to a professional, decoupled system

- Status: draft 3 for review (2026-10-17), revised after three evidence audits (section 3) and the owner's decisions (section 8)
- Supersedes in part: ADR 0003 (web mutations stay on Server Actions), ADR 0004 (wait for a measured trigger before any split)
- Builds on: ADR 0001 (modules), ADR 0002 (gateway), the `/api/v1` app, the jobs module, performance budgets, migration safety

## 1. Why

Birava started as a Next.js project where Next is also the backend. v2 cleaned the edges (gateway, API, CI, migration safety) but the middle is still bootstrap-grade: the application layer is free functions written directly against Prisma, there are no aggregates or domain events, errors are strings, and the web UI does not use the same backend the public API exposes. The goal is a system that is **stable, decisive, predictable, scalable and maintainable**, and to get there by applying proven principles with measurable gates, not by taste.

## 2. Success criteria

Baselines are measured in Epic 0 and each target is checked at the gate of the epic that owns it.

| Quality | Meaning | Measured by (target) |
|---|---|---|
| **Stable** | A breaking change is caught before it ships; a bad release is undone in minutes. | CI pass rate on PRs and pushes at least 95% (today 78%); every red build on a long-lived branch investigated and labelled; no deploy on a red build; rollback rehearsed under 5 minutes; breaking-change check on the OpenAPI document in CI. |
| **Decisive** | Every rule has one owner and one code path; web and native cannot disagree. | Each rule defined once (login policy, session-gap rule, name limits); `apps/web` imports no Prisma, no core and no `"use server"` write; no numeric rule constant in a route or action file. |
| **Predictable** | Same input, same result; errors are typed; the API is versioned; builds reproduce. | Zero string-typed command results (today 56); zero log-less `catch` (today 40 bare); every v1 refusal has a typed code; ids are branded; pinned toolchain and Actions (SHA); p95 budgets per endpoint in CI. |
| **Scalable** | Stateless API, paged reads, the first bottleneck known before it bites. | One cursor envelope on every list; ETags on hot reads; derived counters only when a budget trips (#361/#362); outbox-backed side effects; load scenario in CI; ADR 0004 triggers instrumented. |
| **Maintainable** | A newcomer can find where a thing lives and change it safely. | No `lib/db` import and no `next/*` import in any `application/`; module cycles 0 (today `checkins <-> sessions`); application coverage floor raised from 35% to 70%; a correct README, CONTRIBUTING and per-package README; function-length ratchet in ESLint; after Epic 4 the web app has no framework-specific server runtime and `next` is not a dependency. |

Operability targets (Epic 6) are the SLOs in section 6.

## 3. Evidence (three audits, 2026-10-17)

**Code structure** (hexagonal, DDD, SOLID, Fowler smells). 32.9k lines; depcruise is at zero violations but its rules only cover folders and file-level cycles.
- Application and server code is Prisma-welded: 164 `db`/`tx` lines in application and server versus 15 in infrastructure; 118 exported free functions, 4 repository classes.
- The hero invariant (session assign, merge, split) lives in `drinkEntryCommands.ts` (634 lines): the 4-hour rule exists three times (`groupIntoSessions`, `countSessions`, the DB maintenance) and is held together only by a database-backed property test.
- Crews have no aggregate; `groupCommands.ts` has 0% unit coverage.
- The domain is welded to the wire format: it uses the snake_case transport `DrinkEntry`, hand-maps rows to call it, and one domain file contains UI code (`triggerConfetti`).
- 43 cross-module imports bypass `index.ts`; there is a `checkins <-> sessions` cycle; `notifications/server/notify.ts` (Next `after()`) is imported by five other modules.
- 56 `{ error: "..." }` literals and 40 bare `catch {`, including around the check-in transaction; a post-commit blob failure reports a failed save.
- Side effects are fire-and-forget (`after()`), so a crash between commit and dispatch loses notifications. No domain events or outbox.
- Duplicate rules across front doors: login runs twice with drifted limits (20 vs 10 per 15 min); v1 routes import the web `"use server"` controllers.
- 180 `...Id: string` and no branded types. Commands read the time-zone cookie and return route paths to revalidate.

**API design** (Google AIP, Microsoft REST guidelines, RFC 9457, RFC 9110).
- Not enough for a native app: no signup, password reset or account deletion (required by the App Store), no comment or cheer lists, no profile, stats or achievements, 12 crew actions missing, no native push registration.
- The OpenAPI document has no shared components (zero `$ref`, the error envelope repeated 83 times), untyped ids and timestamps, snake_case in check-ins versus camelCase elsewhere, and does not declare `Idempotency-Key`.
- Domain refusals are mapped from message wording; pagination is three styles; no ETags, no request-id or rate-limit headers, no breaking-change check.
- Good and kept: idempotency implementation, single error envelope, correct `Retry-After`, bearer plus CSRF model, per-operation contract suite.

**Engineering practice** (DORA, Twelve-Factor, SRE, OWASP SAMM, SLSA).
- Branches are protected by a ruleset (PR, required checks, no force-push); 22% of recent CI runs failed, no job timeout or cancel-in-progress, and Vercel deploys independently of CI.
- Every push gets a version tag (199 tags, no semver meaning); about a third of merged PRs are promotion or sync merges.
- No SLOs, OpenTelemetry exports nowhere, the health check flaps, no feature flags, Actions pinned to tags, no CodeQL or SBOM, a stale README, no `SECURITY.md`, `CONTRIBUTING.md` or `CODEOWNERS`, no rollback or incident runbook.
- Good and kept: migration safety (expand/contract, destructive gate, rehearsal), backups with restore drills, the testing shape, ADRs, boot-time env validation, free-tier discipline.

## 4. Non-goals

- No rewrite of the React components: the web client keeps them and changes how data and routes reach them.
- No paid services and no always-on server.
- No email in this phase (decision 2): no password reset or email verification. Known gap, recorded as such: a user who forgets their password has no self-service recovery until an email provider is chosen later.
- No database split; no change to the product invariants; no new product features (data export, account deletion and a sessions list with revoke are platform basics and are included).

## 5. Target architecture

```
apps/web         Vite + React SPA/PWA (TanStack Router, TanStack Query). Static assets, no server runtime. Uses the generated client only.
apps/api         Hono app (today's /api/v1) plus job entry points. The only code that touches the database.
packages/contracts   zod schemas, branded ids, error codes. Source of truth for validation, OpenAPI and the client.
packages/core        domain, application (use-case classes), infrastructure (repositories), ports and adapters.
packages/client      generated typed client (Hey API: first-class OpenAPI 3.1 and one function per operationId).
```

Principles applied, each with its fitness function (a rule in CI, not a guideline):
- **Dependency rule / hexagonal:** domain imports nothing outside itself (no `window`, no wire DTOs); application depends on ports; infrastructure implements them. *Rules:* no `lib/db`, `next/*` or `window` in `domain/` or `application/`.
- **DDD tactical:** `Session` and `Crew` aggregates with pure decision functions and repositories; value objects (`Coordinates`, `DrinkName`); branded ids; domain events through a transactional outbox.
- **Errors as values:** `Result<T, DomainError>` with a closed code union; the edge maps codes to text and to HTTP; no log-less catches; post-commit cleanup is separate from the commit and logged.
- **One owner per rule:** actions and v1 routes are thin adapters over the same use cases; policy constants live in domain or contract.
- **Same-origin by design:** the browser always calls `app.birava.nl/api/...`; the SPA and the API are served from one origin (two Vercel projects joined by a rewrite, or one project during the transition), so cookies, SameSite and the origin check keep working and no CORS is introduced.
- **Why leave Next.js:** with the web app a pure API client, Next adds a server runtime, a bundler and an upgrade treadmill for little benefit to a login-gated, offline-first PWA (SEO belongs to the separate marketing site). This repo already carries its costs: the blocked Next 16 upgrade (#374), the `NODE_ENV` build leak, Turbopack bind-mount errors, the Node-runtime middleware workaround and the dev-server compile race in CI. The trade-off accepted: no SSR or streaming (mitigated by the service worker caching the app shell), and the routing, layout, metadata, image and font features Next provided must be replaced by Vite-side equivalents.

## 6. Stages

Each epic ships independently; its gate must pass before the next starts. Epic 6 runs in parallel.

**Epic 0: Decide, baseline and quick wins.**
- ADR 0005 (supersedes 0003 in part, updates 0004); measure every baseline in section 2.
- Spikes: generated client (Hey API against the cleaned spec); Vite shell feasibility (render three real screens, for example the dashboard, a session and the log form, from the existing components with TanStack Router, covering the auth gate, service worker, manifest, image loader and fonts).
- Quick wins from the audits: correct README, `CONTRIBUTING.md`, `SECURITY.md`, `CODEOWNERS`; delete the 14 dead exports; CI `timeout-minutes` and cancel-in-progress; stop deploying on red; pin Actions to SHAs; rollback and incident runbooks; align CI Node and Postgres with production; fix the health-check flapping.
- Gate: ADR accepted, baselines recorded, CI pass rate measured weekly.

**Epic 1: A real application core (the heart of the work).**
1. `Result` and typed `DomainError`; remove string results and log-less catches; separate commit from post-commit cleanup.
2. Repository ports and use-case classes with constructor injection (the repo's own OOP preference), starting with checkins, sessions, crews, identity; inject a `Clock` and the time zone; no `next/*` or `lib/db` in `application/`.
3. Extract a pure `SessionPlanner` (`planInsert`, `planDelete`) from `drinkEntryCommands.ts` and run the existing property test against it in the unit project; one definition of the 4-hour rule.
4. `Crew` aggregate with unit and property tests.
5. Domain types independent of the wire format; derive DTOs with `z.infer`; branded ids and the `Coordinates` value object; move `triggerConfetti` out of the domain.
6. Module boundary guards: `index.ts` only (including `server/` and `actions/`), a module-cycle check, a `NotificationPublisher` port; one `AuthService` shared by web and v1.
- Gate: the maintainability and predictability rows of section 2 that this epic owns are green; the full existing test suite passes unchanged at each step; the session property test now also runs with no database.

**Epic 2: Workspaces, contracts and API parity.**
- npm workspaces plus Turborepo; `packages/contracts`, `packages/core`, `apps/*`; per-package CI jobs (#375).
- API quality: register named schemas (single `Error`), real formats (uuid, date-time), strict objects, `onlyOwn` as a boolean; RFC 9457 problem details with a domain `reason` next to the code; declared `Idempotency-Key`; `X-Request-Id` and rate-limit headers; weak ETags and `If-Match` on hot reads; one cursor envelope on every list; `oasdiff` breaking-change check; versioning and deprecation policy; API reference page; `PUT/DELETE` cheer.
- **Break v1 now and set the standard** (decision 3): v1 has no external client yet and the web does not use it, so it is corrected in place instead of versioned around its flaws. The standard: camelCase everywhere including check-ins; RFC 3339 timestamps in requests and responses; branded uuid ids; every list is `{ items, nextPageToken }`; every mutation returns the resource (or 204), never `{}`; RFC 9457 errors with a stable domain `reason`; `Idempotency-Key` on every unsafe operation. The version number starts to mean something at the first external client; from then on changes are additive and checked by `oasdiff`.
- Parity for the web: profile and stats and achievements, comments and cheers lists, 12 crew actions, settings and preferences, push-token registration, signup and account deletion. No password-reset endpoint (decision 2).
- Generated `packages/client` (Hey API) exercised in CI against the API.
- Gate: a contract test per operation through the generated client; breaking-change check green.

**Epic 3: Web as a client (still inside Next).** Screens move one vertical slice at a time to the generated client with TanStack Query, each slice deleting its Server Actions and direct reads; view-model builders replace presentation logic in the longest components. Doing this inside Next first keeps every step shippable and changes only data access, not routing. Gate per slice: its E2E specs pass unchanged and its p95 stays inside budget. Epic gate: depcruise forbids `apps/web` from importing core, Prisma or any `"use server"` write.

**Epic 4: Retire Next.js (gated on the Epic 0 spike).** With data access already behind the client, the shell swap is routing, layout, metadata, auth gate, image and font handling only: TanStack Router with route-level code splitting; a client auth gate (a 401 from the API redirects to login) replacing `middleware.ts`; the existing TypeScript service worker caches the app shell and keeps offline behaviour; the manifest and icons move to static assets; deploy as static files plus the API functions on the free tier. Cut over in one release behind the rewrite, keeping the old Next build deployable for rollback until the first week is clean. Gate: all E2E specs (including WebKit) pass against the SPA, p95 and bundle budgets hold, the Lighthouse PWA and performance scores do not regress, and `next` is removed from `package.json`.

**Epic 5: Events and the optional API split.** Domain events with a transactional outbox, drained by the jobs module; notifications and achievements become idempotent consumers. A separate Vercel project for `apps/api` behind the web project's rewrite only if an ADR 0004 trigger is measured. Gate: events replay safely; the split decision records its number.

**Epic 6: Operability and professional baseline (parallel).**
- SLOs and alerting: availability 99.5% from an external monitor with 1 to 5 minute probes, check-in write success 99.5%, p95 feed under 800 ms and write under 600 ms, outbox sync success 99%, job freshness and backup freshness (already in `/api/health`), client errors under 1 per 1000 sessions; page on burn rate, not blips. Error-budget summary posted daily.
- Observability on the managed LGTM stack (Grafana Cloud free tier; self-hosting would need an always-on server and is excluded by the no-cost rule): OTLP traces and logs from `apps/api` through the already-wired `@vercel/otel`, exports flushed with `after()` or `waitUntil` so serverless freezes do not drop data; Grafana Faro for browser errors and real-user monitoring (replacing the hand-rolled `ClientErrorLog` once proven); request-id correlation from browser to database; Grafana alerting and synthetic probes replacing the email-only health check. Vercel log drains need a paid plan, so logs leave through OpenTelemetry, not drains. Spike first: confirm the current free-tier limits, the serverless flush behaviour and the alert delivery channels.
- Release engineering inside the kept dev, staging, main flow: conventional commits, release-please, tags on production releases only (ending the tag-per-push cascade), automated sync PRs between branches to remove the promotion noise, `CODEOWNERS`, `CONTRIBUTING.md` and a PR checklist for the second developer; a feature-flag table to separate deploy from release.
- Supply chain and security: CodeQL, `npm audit`, SBOM, secret scanning, the pentest leftovers (trusted `APP_ORIGIN` for blob callbacks, explicit `Origin` fallback for actions), a rotation table.
- Account basics: data export (access and portability), sessions list with revoke. Email-dependent items (password reset, verification) are deferred by decision.
- Quality: accessibility checks in CI, flake labelling for E2E, a stricter coverage ratchet; Prisma 7 (#373) with a full-data rehearsal; the Next 16 question (#374) is closed as won't-do once Epic 4 lands.

## 7. Risks

| Risk | Handling |
|---|---|
| The core refactor touches the hero invariant | Property and integration tests stay the oracle; every step lands behind passing tests; the pure planner is proven equal to the old code by the same property test. |
| Extra network hop slows pages | Same-origin in-process first; budgets measure each slice; the split is gated on numbers. |
| Losing Server Action ergonomics | Accepted: one code path for web and native; generated client and TanStack Query replace the boilerplate. |
| Big-bang migration | One vertical slice at a time, old path deleted only after the slice ships. |
| Auth and CSRF regress | Same cookie and origin model; the pentest checks re-run before Epic 3 closes. |
| Process changes confuse the team | Each process change is its own small issue with a rollback; the second developer reviews `CONTRIBUTING.md` before it merges. |
| The SPA loads slower on mobile data than server rendering | Route-level code splitting, the service worker serving the cached shell, a bundle budget in CI and a Lighthouse gate in Epic 4; the Epic 0 spike measures it before any commitment. |
| Retiring Next loses conveniences (image optimisation, fonts, metadata) | Each has a Vite-side replacement listed in the spike; the existing custom image loader and TypeScript service worker already do most of this work. |
| No password recovery without email | Accepted for now and recorded as a known gap; revisited when an email provider is chosen. |

## 8. Decisions

Decided by the owner (2026-10-17):
1. **Next.js is a bootstrap to move away from**, not a long-term base: the web client becomes a Vite SPA/PWA (Epic 4), subject to the Epic 0 feasibility spike.
2. **Email is out of scope for now**; Resend's free tier leaves gaps to fill later. No password reset or verification in this phase.
3. **Break v1 now and set the standard** (Epic 2), instead of carrying its flaws.

4. **Branch flow: keep dev, staging, main.** A second developer joins the project and staging is the shared integration point. The audit's concern (promotion and sync noise) is handled by automation and by tagging only on production releases, not by removing a tier.
5. **Observability: the managed LGTM stack (Grafana Cloud free tier)**, subject to the Epic 6 spike confirming limits, serverless flushing and alert channels. Self-hosted LGTM is out (always-on cost).

Nothing is open for the owner at the time of writing; the spikes in Epic 0 and Epic 6 can still overturn a decision with evidence, in which case the ADR records it.

## 9. Issue structure

One epic issue per stage (Epic 0 to 6) in the v2 format: tasks as a checklist, a gate, "work one phase at a time". Existing issues are absorbed: #375 into Epic 2; #359 and #360 into Epic 1; #361 and #362 into Epic 2 and the budgets; #373 into Epic 6; #374 closed as won't-do by Epic 4; #323 into Epic 6; #377 replaced by Epic 5. Each task is sized to one PR.
