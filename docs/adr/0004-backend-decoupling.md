# ADR 0004: Decoupling a separate backend service: path and triggers

- Status: accepted (2026-10-15), to be revisited at the triggers below
- Context: Birava v2 follow-up, issue #376

## Context

Birava is one Next.js deployment: pages, Server Actions, route handlers, the `/api/v1` Hono app and the cron routes all run as Vercel functions against one Postgres. That is the right size today (free tiers, one deploy, one place to look). The v2 work made a later split cheap but did not do it, so this records when to do it and how, so the decision is made on evidence rather than taste.

## What already makes a split cheap

- **Module boundaries are enforced** (ADR 0001): `modules/*/application`, `infrastructure` and `domain` import no Next, React or `app/`. The code a service would run is already separate from the code that renders.
- **One gateway** (ADR 0002) and **one versioned API** (ADR 0003): every entry point has validation, auth, limits, idempotency and one error shape, and the API is described by an OpenAPI document.
- **Repository ports and an outbox with ports**: storage and the HTTP edge are replaceable without touching rules.
- **Hono is runtime-agnostic**: the `/api/v1` app runs unchanged on a long-lived Node process, Cloudflare Workers or Vercel.

## Triggers

Split when one of these is measured, not when it is merely imaginable:

1. **Function limits bite.** A job or request regularly needs more than the platform's duration limit (cleanup, purge and reminders are bounded per run today to stay under 60s), or serverless connection churn exhausts Postgres connections even with pooling.
2. **Cold starts hurt the API.** Native-client p95 on `/api/v1` is dominated by cold starts or by the Next bundle's size, and a warm service would fix it.
3. **Independent scaling or release cadence.** The API needs to scale or deploy on a different rhythm from the web UI, for example a native app release train that cannot wait for web deploys, or a second team owning the backend.
4. **Cost.** The free-tier envelope (a standing constraint) is breached by function invocations while a single small always-on instance would not breach it. Hosting spend is not accepted for its own sake.
5. **Long-lived work appears**: websockets, live feeds, queues, anything that wants a process that stays up.

None is true today. The performance budgets (phase 3) and `/api/health` are the instruments that will show the first two.

## Path

Each step is independently shippable and reversible.

1. **Workspaces first** (#375): move to npm workspaces with `packages/contracts` (zod schemas and DTO types from each `modules/*/contract`) and the modules as a package, so web and service import one source. Do this when a second consumer exists, not before.
2. **Run the API standalone.** Build the `/api/v1` Hono app as its own entry (`serve()` on Node) from the same modules, deployed beside the web app. Next keeps rendering and keeps calling modules in-process; native clients point at the service. No data move, same database.
3. **Move scheduled work.** The job classes and `JobRunner` run in the service on its own scheduler; GitHub Actions stops pinging Vercel routes. `JobRun` and `/api/health` carry over as they are.
4. **Optionally move web mutations** to the API (the decision deferred in ADR 0003), once the extra hop is measurable and the service is the thing worth exercising daily.
5. **Only then consider splitting the database**, per module, and only if a module's data has a different shape or scale. The module boundaries make this possible; nothing here requires it.

## Consequences

- No work is scheduled now. The cost of waiting is low because every step above builds on boundaries that already exist and are tested.
- A step is not started without its trigger being written down with a number (a p95, an error rate, a bill).
- Anything added in the meantime keeps to the module rules, which is what keeps the path open.
