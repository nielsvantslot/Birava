# ADR 0002: One gateway for every Route Handler and Server Action

- Status: accepted (2026-10-15)
- Context: Birava v2, phase 2 (gateway), issues #350 to #358

## Context

Before this change each of the 18 route handlers and 56 server actions repeated its own authentication, hand-rolled its own error shape (`{ error }`, `204` bodies, plain `Unauthorized` text) and trusted whatever the client sent: `JsonSerializer.deserialize` copied known keys and coerced everything else to an empty string, and server actions took a TypeScript type that nothing checked at runtime. Every export of a `"use server"` file is a public POST endpoint, so that last gap is a real one.

## Decision

All code the outside world can call is built through one gateway, `lib/gateway`, composed once in `modules/identity/server/gateway.ts`:

```ts
export const POST = gateway.route.authed({ name: "notifications.opened" }, async ({ user, params }) => { ... });
export const followUser = gateway.action.authed({ name: "social.follow", input: followUserInput }, async ({ user, input }) => { ... });
```

| Builder | For | Steps, in order |
| --- | --- | --- |
| `route.authed` | signed-in Route Handlers | origin check (mutations), session, rate limit, input validation, handler, error mapping |
| `route.public` | login, signup, the error beacon | origin check, rate limit (required: a number or an explicit `false`), validation, handler |
| `route.cron` | scheduled jobs | shared-secret check only (no session, origin or rate limit) |
| `action.authed` / `action.public` | Server Actions | session, rate limit, validation, handler, error mapping |

### Input contracts

Each module owns zod schemas for the inputs it accepts in `modules/<name>/contract/`. The gateway parses before the handler runs, so a malformed request is rejected with field-level messages and never reaches a command. Result DTOs stay as the existing classes in `lib/dtos` for now; only inputs are validated, because inputs are what an attacker controls.

### One error envelope

Failing routes return `{ "error": { "code", "message", "fields?" } }` with a closed list of codes (`lib/gateway/ErrorCode.ts`) mapped to HTTP statuses in one place. A handler signals an expected failure by throwing `ApiError`; anything else is logged with the request id and answered with `INTERNAL`, never with its message. Failing server actions return `{ error, code, fields? }`: a superset of the `{ error?: string }` the web UI already reads, built from the same codes. Unexpected action errors are rethrown so Next shows its generic error.

### Defaults

- Authenticated mutations are limited to 300 per user per minute per endpoint (generous enough for an offline queue flushing), with per-endpoint overrides. Reads are not counted unless asked.
- Mutating routes reject a mismatched `Origin`, or an explicit `Sec-Fetch-Site: cross-site` when `Origin` is absent, on top of SameSite cookies. Server Actions get this from Next. Cron routes are exempt because they authenticate with a bearer secret, not a cookie.
- Reads that a page needs are query functions called directly by pages, not server actions: an action is a public endpoint and should only be a mutation.

## Gate

An architecture test (`lib/gateway/gatewayCoverage.test.ts`) lists every `app/api/**/route.ts` export and every export of a `"use server"` file and fails unless each is built through `gateway.*`. Adding an unwrapped endpoint fails CI.

## Consequences

- One place to change how auth, limits, errors and logging behave, for web today and a public `/api/v1` later.
- Clients that read `error` as a string must read the envelope; `ErrorEnvelope.messageFrom` accepts both shapes.
- Every wrapped mutation pays one rate-limit write. Acceptable at this scale; `rateLimit: false` exists for the hot, cheap cases.
