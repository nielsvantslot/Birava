# Birava v3: from bootstrap to a professional, decoupled system

- Status: draft 2 for review (2026-10-17), revised after three evidence audits (section 3)
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
| **Maintainable** | A newcomer can find where a thing lives and change it safely. | No `lib/db` import and no `next/*` import in any `application/`; module cycles 0 (today `checkins <-> sessions`); application coverage floor raised from 35% to 70%; a correct README, CONTRIBUTING and per-package README; function-length ratchet in ESLint. |

Operability targets (Epic 5) are the SLOs in section 6.

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

- No UI framework rewrite (Next.js stays as the web client; decoupling makes replacing it later a contained job).
- No paid services and no always-on server.
- No database split; no change to the product invariants; no new product features (password reset, verification, data export, account deletion are platform basics and are included).

## 5. Target architecture

```
apps/web         Next.js client. Pages, components, TanStack Query; a generated client only.
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
- **Same-origin by design:** the browser always calls `app.birava.nl/api/...` (in-process now; a rewrite to a second Vercel project later), so cookies, SameSite and the origin check keep working and no CORS is introduced.

## 6. Stages

Each epic ships independently; its gate must pass before the next starts. Epic 5 runs in parallel.

**Epic 0: Decide, baseline and quick wins.**
- ADR 0005 (supersedes 0003 in part, updates 0004); measure every baseline in section 2.
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
- Parity for the web: profile and stats and achievements, comments and cheers lists, 12 crew actions, settings and preferences, push-token registration, signup, password reset and account deletion; typed camelCase aliases for the check-in shape (full fix deferred to a v2 of the API).
- Generated `packages/client` (Hey API) exercised in CI against the API.
- Gate: a contract test per operation through the generated client; breaking-change check green.

**Epic 3: Web as a client.** Screens move one vertical slice at a time to the generated client with TanStack Query, each slice deleting its Server Actions and direct reads; view-model builders replace presentation logic in the longest components. Gate per slice: its E2E specs pass unchanged and its p95 stays inside budget. Epic gate: depcruise forbids `apps/web` from importing core, Prisma or any `"use server"` write.

**Epic 4: Events and the optional split.** Domain events with a transactional outbox, drained by the jobs module; notifications and achievements become idempotent consumers. A separate Vercel project for `apps/api` behind the web project's rewrite only if an ADR 0004 trigger is measured. Gate: events replay safely; the split decision records its number.

**Epic 5: Operability and professional baseline (parallel).**
- SLOs and alerting: availability 99.5% from an external monitor with 1 to 5 minute probes, check-in write success 99.5%, p95 feed under 800 ms and write under 600 ms, outbox sync success 99%, job freshness and backup freshness (already in `/api/health`), client errors under 1 per 1000 sessions; page on burn rate, not blips. Error-budget summary posted daily.
- Observability: point OpenTelemetry at a free-tier exporter, error aggregation on a free tier, request-id correlation from browser to database.
- Release engineering: conventional commits, release-please, tags on production releases only; a feature-flag table to separate deploy from release; a decision on collapsing the branch flow (see section 8).
- Supply chain and security: CodeQL, `npm audit`, SBOM, secret scanning, the pentest leftovers (trusted `APP_ORIGIN` for blob callbacks, explicit `Origin` fallback for actions), a rotation table.
- Account basics: password reset, email verification, data export (access and portability), sessions list with revoke.
- Quality: accessibility checks in CI, flake labelling for E2E, a stricter coverage ratchet; Prisma 7 (#373) with a full-data rehearsal; Next 16 re-check (#374).

## 7. Risks

| Risk | Handling |
|---|---|
| The core refactor touches the hero invariant | Property and integration tests stay the oracle; every step lands behind passing tests; the pure planner is proven equal to the old code by the same property test. |
| Extra network hop slows pages | Same-origin in-process first; budgets measure each slice; the split is gated on numbers. |
| Losing Server Action ergonomics | Accepted: one code path for web and native; generated client and TanStack Query replace the boilerplate. |
| Big-bang migration | One vertical slice at a time, old path deleted only after the slice ships. |
| Auth and CSRF regress | Same cookie and origin model; the pentest checks re-run before Epic 3 closes. |
| Process changes confuse a solo flow | Each process change is its own small issue with a rollback. |

## 8. Decisions needed from the owner

1. **Branch flow.** The three-tier dev, staging, main flow costs about a third of merged PRs in promotion and sync merges. Options: keep it; or make `dev` trunk with staging as a Vercel preview or a fast-forward promotion. Recommended: simplify, but it is your call and independent of the code work.
2. **Free-tier providers.** An email sender for password reset and verification; an exporter for traces and errors. Spikes in Epic 5 pick from free tiers; no spend.
3. **API v1 casing.** Keep the snake_case check-in shape in v1 with camelCase aliases and fix it properly in a future v2 (recommended), or break v1 now while it has no external clients.

## 9. Issue structure

One epic issue per stage (Epic 0 to 5) in the v2 format: tasks as a checklist, a gate, "work one phase at a time". Existing issues are absorbed: #375 into Epic 2; #359 and #360 into Epic 1; #361 and #362 into Epic 2 and the budgets; #373 and #374 into Epic 5; #323 into Epic 5; #377 replaced by Epic 4. Each task is sized to one PR.
