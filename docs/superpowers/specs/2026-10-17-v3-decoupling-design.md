# Birava v3: decoupling the web app from the backend

- Status: draft for review (2026-10-17)
- Supersedes in part: ADR 0003 (web mutations stay on Server Actions), ADR 0004 (wait for a measured trigger before any split)
- Builds on: ADR 0001 (modules), ADR 0002 (gateway), the `/api/v1` app, the jobs module, the performance budgets

## 1. Why

Birava runs as one Next.js deployment where Next is also the backend. The v2 work made the backend clean and separable (modules, gateway, `/api/v1`, repository ports), but the web UI does not use it: 57 files in `app/` and `components/` import `modules/*/server` reads, and 14 `"use server"` files are how the UI writes. The public API is a second front door the web never walks through. So web and native would diverge, and the backend cannot be run, tested or deployed without the web framework.

The goal is a project that is stable, decisive, predictable, scalable and maintainable. Those words are made measurable in section 2 so that "done" is a number, not a feeling.

## 2. Success criteria

Each quality has a baseline measured in Epic 0 and a target checked at the end of the epic that owns it.

| Quality | Meaning here | Measured by |
|---|---|---|
| **Stable** | A change that breaks a client is caught before it ships, and a bad release is undone in minutes. | Contract suite runs the generated client against the API in CI; CI flake rate under 2% over 30 days; rollback documented and rehearsed under 5 minutes; zero migrations applied without the rehearsal gate. |
| **Decisive** | Every behaviour has one owner and one code path. Web and native cannot disagree. | `apps/web` has no import of Prisma, `packages/core` or any `"use server"` write; each rule exists once (checked by dependency rules, not by review). |
| **Predictable** | The same input gives the same result, errors are typed, the API is versioned, builds are reproducible. | Typed error codes on every v1 refusal (no English-wording mapping); additive-only changes inside a version enforced by an OpenAPI diff check; lockfile and toolchain pinned; p95 budgets per endpoint in CI. |
| **Scalable** | The API is stateless, reads are paged, and the first bottleneck is known before it bites. | Cursor paging on every list; derived counters behind the budgets that trigger them (#361/#362); load test of the heavy-account scenario in CI; ADR 0004 triggers instrumented. |
| **Maintainable** | A new contributor can find where a thing lives and change it safely. | Workspace boundaries enforced by depcruise; each package has a README and an owner; per-package test and build under their own CI job; no file over 400 lines without a recorded reason. |

## 3. Non-goals

- No rewrite of the UI framework. Next.js stays as the web client; the decoupling is what makes replacing it later a contained job, not part of this work.
- No paid services and no always-on server (standing rule: free tiers).
- No database split, and no change to the product invariants (session as hero unit, variety over volume, accent discipline).
- No new product features. Password reset, email verification and data export are included because they are missing platform basics, not features.

## 4. Target architecture

```
apps/web         Next.js client. Pages, components, TanStack Query. Talks to the API through a generated client only.
apps/api         Hono app (the current /api/v1) plus the job entry points. The only code that touches the database.
packages/contracts   zod schemas, DTO types, error codes. Source of truth for validation, the OpenAPI document and the client.
packages/core        domain, application, infrastructure (today's modules/*), with ports and adapters as in ADR 0001.
packages/client      generated typed client from the OpenAPI document (web and, later, native).
```

Rules, enforced by dependency-cruiser and ESLint:
- `apps/web` imports `contracts` and `client` only.
- `apps/api` imports `contracts` and `core`.
- `core/domain` stays free of frameworks (as today); `core` never imports `apps/*`.

Tooling: npm workspaces plus Turborepo (task graph and caching, free). TanStack Query in the web app for caching, optimistic updates and offline persistence; the existing outbox flusher stays for offline writes. OpenAPI to TypeScript client generation (openapi-typescript or Hey API; chosen in a spike). Prisma stays and is upgraded to 7.

Same-origin by design: the browser always calls `app.birava.nl/api/...`. While deployed together that is in-process; if the API is later a second Vercel project, a rewrite at the web project forwards `/api/*` to it. Cookies, SameSite and the existing origin check keep working and no CORS is introduced.

## 5. Stages

Each stage is its own epic and ships independently. The gate must pass before the next stage starts.

**Epic 0: Decide and baseline.** ADR 0005 (supersedes 0003 in part, updates 0004); measure the baseline for every row of section 2; spike the client generator. Gate: ADR accepted, baselines recorded in the epic.

**Epic 1: Workspaces and contracts (#375).** Convert the repo to workspaces, move `modules/*` into `packages/core`, extract `packages/contracts`, add Turborepo and per-package CI jobs, update depcruise rules. No behaviour change. Gate: everything green, deploy identical, build and test times not worse than baseline.

**Epic 2: API parity and contract hardening.** Every read and write the web UI needs exists in v1 (the 56 actions and the reads); typed error codes replace wording-based mapping; cursor paging (#362) on feeds and history; versioning policy and an OpenAPI diff check in CI; generated `packages/client`; API reference page from the OpenAPI document. Gate: a contract test per operation, run through the generated client.

**Epic 3: Web as a client.** Screens move one vertical slice at a time to the generated client with TanStack Query, each slice deleting its Server Actions and direct reads. Auth stays the same session cookie. Gate per slice: its E2E specs pass unchanged and its p95 stays within budget; gate for the epic: `apps/web` no longer imports `core`, Prisma or any `"use server"` write (depcruise rule turned on).

**Epic 4: Events and optional physical split.** Domain events with a transactional outbox: notifications and achievements become consumers instead of inline calls. Then, only if a trigger from ADR 0004 is measured, deploy `apps/api` as its own Vercel project behind the web project's rewrite and move the cron entry points with it. Gate: events replay safely (idempotent consumers, tested); split decision recorded with the number that justified it.

**Epic 5: Professional baseline** (runs in parallel after Epic 0; independent of the stages above).
- Account basics: password reset, email verification (free-tier email provider chosen in a spike), data export (access and portability), a sessions list with revoke.
- Observability: structured traces across web and API (OpenTelemetry), error tracking without a paid service, alerting on `/api/health` and the budgets, written SLOs.
- Security process: `SECURITY.md`, CodeQL and secret scanning, Actions pinned to SHAs with minimal `permissions`, the pentest leftovers (trusted `APP_ORIGIN` for blob callbacks, explicit `Origin` fallback for actions).
- Release engineering: conventional commits, automated changelog and release tags, rollback runbook, incident runbook.
- Quality: accessibility checks in CI, feature flags for dark launches, flake budget for E2E.
- Platform upgrades: Prisma 7 (#373) with a full-data rehearsal; Next 16 re-evaluation (#374).

## 6. Risks and how they are handled

| Risk | Handling |
|---|---|
| Extra network hop slows pages | Same-origin in-process first; budgets measure every slice; the split (Epic 4) is gated on numbers. |
| Losing Server Action ergonomics | Accepted: one code path for web and native is the point. The generated client and TanStack Query replace the boilerplate. |
| Big-bang migration | Migration is per vertical slice, behind passing E2E, with the old path deleted only after the slice ships. |
| Auth and CSRF regress | Same cookie and origin model (no CORS); a dedicated security pass and the pentest scripts re-run before Epic 3 closes. |
| Offline outbox breaks | The flusher already has no browser dependency; its sender port moves to the generated client with the existing tests. |
| CI gets slower in a monorepo | Turborepo caching and per-package jobs; baseline compared at each gate. |
| Scope creep into features | Non-goals above; each epic closes on its gate. |

## 7. Issue structure

One epic issue per stage (Epic 0 to 5) in the same format as the v2 plan: tasks as a checklist, a gate, and "work one phase at a time". Existing issues are absorbed: #375 into Epic 1; #359 and #360 into Epic 1/2; #361 and #362 into Epic 2 and the budgets; #373 and #374 into Epic 5; #376 is done; #377 is replaced by Epic 4's events work; #323 into Epic 5 quality. Each task is sized to one PR.

## 8. Open questions

1. Client generator: openapi-typescript with a thin fetch wrapper, or Hey API (spike in Epic 0).
2. Email provider for password reset and verification within free tiers (spike in Epic 5).
3. Whether `apps/api` runs as a Vercel project from day one of Epic 4 or stays in-process until a trigger fires (default: stays).
