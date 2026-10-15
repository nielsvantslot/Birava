# ADR 0003: The public API at /api/v1

- Status: accepted (2026-10-15)
- Context: Birava v2, phase 4 (native-ready), issues #367, #368, #369, #372

## Context

A native client needs a stable, documented API with its own kind of session. The web app already has everything underneath: commands, queries and a gateway with auth, limits, validation and idempotency. What was missing was a versioned HTTP surface that is not tied to cookies or to Next's Server Action wire format.

## Decision

### One Hono app, mounted whole

`app/api/v1/[[...route]]/route.ts` mounts a single Hono app (`@hono/zod-openapi`) through `gateway.route.mounted`, so it still passes the gateway coverage gate. Each endpoint is a `createRoute` definition with its request schemas, its responses and its error responses, registered in `app/api/v1/_hono/routes/*`. The OpenAPI 3.1 document is generated from those definitions, served at `/api/v1/openapi.json`, and committed at `docs/api/openapi.v1.json` (CI fails if the committed copy is stale: `npx tsx scripts/generate-openapi.ts --check`).

The handlers are thin: they call the same web actions and reads the UI uses (`modules/*/actions`, `modules/*/server/*Reads`) and turn their results into responses. So the API and the web UI cannot drift apart in behaviour, validation or limits; the per-endpoint guards (`V1Guards`) are the same gateway classes (rate limit, idempotency, origin check) used by the web gateway.

### Versioning

Everything under `/api/v1` is additive: new fields, endpoints and optional parameters ship in v1. A removed or renamed field, a changed meaning, or a new required input ships as `/api/v2` alongside it, and v1 keeps working until its clients are gone.

### Errors and retries

Every failure is the gateway envelope `{ error: { code, message, fields? } }` with the closed code list. A domain refusal that carries no code is mapped from its wording ("not found" is a 404, "only the owner can" a 403, anything else a 400). A mutation may carry an `Idempotency-Key` header; the first successful response is replayed for a repeat (`Idempotent-Replay: true`).

### Bearer-token sessions

`POST /auth/token` signs in with email and password and returns an opaque token. The token is a row in the existing `Session` table, the same table a browser's cookie points at, so every way of ending sessions covers both: `DELETE /auth/token` (one device), `POST /auth/logout-all` (every session and token), account deletion (wipes all sessions), and expiry. `getCurrentUser()` resolves a cookie or an `Authorization: Bearer` header, so actions and reads need no change. Sign-in is rate limited per IP (30 per five minutes); mutations per user (300 per minute). A cookie-authenticated mutation must pass the same origin check as the web routes; a bearer-authenticated one does not need it, since a browser never attaches a bearer token by itself.

### The gate

`tests/integration/api-v1/api-v1.contract.test.ts` runs five scenarios against every registered operation: valid input (status and body checked against the declared response schema), invalid input (400 with field errors), unauthenticated (401), rate limited (429 with Retry-After), idempotent replay. Each operation needs an entry in `V1_FIXTURES`; an operation without one fails the suite, so an endpoint cannot ship without its contract tests.

## Decision #372: web mutations stay on Server Actions

Should the web UI's mutations also call `/api/v1`, so the API is exercised daily? **No, not now.**

- Cost: one extra in-deploy HTTP hop per mutation, and the web would have to carry bearer tokens or rely on the cookie path through the same origin check.
- Benefit is already mostly captured: the API handlers call the very same actions the UI calls, so daily web use exercises the code behind the API. What it would not exercise is the thin HTTP layer, which the contract suite covers on every change.
- Server Actions give the web UI CSRF protection and typed calls for free.

Revisit when a native client ships and there is something to measure: if the HTTP layer proves to be where bugs hide, routing the web through it becomes worth its hop.

## Consequences

- A native client can be built against the committed OpenAPI document without reading the web code.
- Adding an endpoint is a route definition plus a fixture; forgetting the fixture fails CI.
- The API is deliberately a subset: auth, the signed-in user, the feed and check-ins, sessions, social, crews and notifications. Settings screens and the crew administration actions are not in v1 yet; they can be added when a client needs them, additively. Photos use the existing upload routes (`/api/uploads/drink-photo` and its token and finalize steps), which accept the same bearer token because they authenticate through `getCurrentUser()`; the resulting URL goes into `createCheckin`.
