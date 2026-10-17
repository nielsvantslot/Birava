# v3 Epic 1a: Result foundation and check-in commands Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give commands a typed, closed failure model (`Result<T, DomainError>`), stop reporting a committed check-in as a failed save, and make the three check-in commands return typed results instead of `{ error: string }`.

**Architecture:** A small shared-kernel module `lib/result` defines `DomainError` (a closed `reason` union plus the transport `ErrorCode` it maps to), `Result<T>` and a `ResultMapper` that turns a failed result into the existing `ApiError`, so the gateway, the web actions and v1 keep working unchanged. Commit and post-commit cleanup are separated in the check-in commands so cleanup failures are logged, never reported as a failed save. The web contract (`result.error` strings, `code`) is preserved; v1 gains a stable `reason`.

**Tech Stack:** TypeScript, Vitest (unit and integration projects), Prisma, the existing gateway (`lib/gateway`).

**Spec:** `docs/superpowers/specs/2026-10-17-v3-decoupling-design.md` (Epic 1; issues #458 and #460, foundation for #459). Later plans: 1b (#461 Clock and time zone), 1c (#459 other modules), then #462 and on.

## Global Constraints

- **Never run bare `vitest`, `npm test`, or any integration project against the dev database.** Run unit tests with `docker exec birava-app npx vitest run --project unit <path>`. Integration tests run only through `npm run test:integration` (it loads `.env.test` and uses the separate test database) or in CI. The integration project truncates the database it connects to; a bare `vitest run` inside the container once wiped the local dev database.
- Everything runs in Docker: `docker exec birava-app ...` (typecheck: `docker exec birava-app npx tsc --noEmit`; lint on the host: `npm run lint`; boundaries: `docker exec birava-app npm run depcruise`).
- C#-style OOP for new non-React code (repo preference): static classes, no new exported free functions, one `I`-prefixed interface per file, constructor injection.
- Web contract is unchanged: actions still return `{ error: string, code }` on refusal and the success fields otherwise; the same user-facing messages are kept.
- No behaviour change to the session invariants, the 7-day backdate clamp or the photo-URL vetting.
- Vocabulary and copy rules from CLAUDE.md apply to any user-facing string (sentence case, "check-in", no emoji).
- After a schema or contract change that affects `/api/v1`, regenerate and commit `docs/api/openapi.v1.json` (`docker exec birava-app npm run openapi:generate`) and never commit a `package-lock.json` change produced by a local npm run.
- Commit style: one commit per task, message ends with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- A blob or cache cleanup failure after a successful commit must still return success (and log): pinned in Task 2.
- A genuine transaction failure must still return the failure and be logged with the user and entry id, not swallowed: pinned in Task 2.
- Deleting or updating another user's check-in must stay a not-found, not a forbidden or a success: pinned in Task 3.
- A replayed create (same `clientId`) must still return the original success shape: pinned in Task 3.
- A new refusal reason with no mapping must fail the build, not default to 400: pinned in Task 1.

---

## File Structure

- Create `lib/result/DomainError.ts`: the closed reason union, its transport-code table, and the `DomainError` class (one responsibility: describe an expected failure).
- Create `lib/result/Result.ts`: `Result<T>` type plus `Ok` and `Err` constructors as static helpers on a `Results` class.
- Create `lib/result/ResultMapper.ts`: `orThrow` (to `ApiError`) used by adapters.
- Create `lib/result/DomainError.test.ts` and `lib/result/ResultMapper.test.ts`.
- Modify `lib/gateway/ApiError.ts`, `lib/gateway/ErrorEnvelope.ts`: carry an optional `reason`.
- Modify `modules/checkins/application/drinkEntryCommands.ts`: separate commit from cleanup; return `Result`.
- Modify `modules/checkins/actions/drinkController.ts` and its test: unwrap results.
- Modify tests that call the commands directly (listed in Task 3).

---

### Task 1: DomainError, Result and ResultMapper

**Files:**
- Create: `lib/result/DomainError.ts`, `lib/result/Result.ts`, `lib/result/ResultMapper.ts`
- Modify: `lib/gateway/ApiError.ts`, `lib/gateway/ErrorEnvelope.ts`
- Test: `lib/result/DomainError.test.ts`, `lib/result/ResultMapper.test.ts`, `lib/gateway/ErrorEnvelope.test.ts` (create if absent)

**Interfaces:**
- Produces: `DomainReason` (string union), `DomainError` with `.reason`, `.message`, `.code`; `Result<T>`; `Results.ok(value)`, `Results.fail(reason, message?)`; `ResultMapper.orThrow(result)` returning `T` or throwing `ApiError` carrying `reason`.
- Consumes: `ErrorCode` from `lib/gateway/ErrorCode.ts`, `ApiError` from `lib/gateway/ApiError.ts`.

- [ ] **Step 1: Write the failing tests**

`lib/result/DomainError.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DOMAIN_REASONS, DomainError } from "./DomainError";

describe("DomainError", () => {
  it("maps every reason to a transport code (a new reason without one is a type error and fails here)", () => {
    for (const reason of DOMAIN_REASONS) {
      expect(DomainError.of(reason).code).toMatch(/^[A-Z_]+$/);
    }
  });

  it("uses the reason's default message unless one is given", () => {
    expect(DomainError.of("PHOTO_INVALID").message).toBe("That photo isn't valid. Pick it again.");
    expect(DomainError.of("PHOTO_INVALID", "Custom").message).toBe("Custom");
  });

  it("maps check-in reasons to the codes the web already shows", () => {
    expect(DomainError.of("CHECKIN_NOT_FOUND").code).toBe("NOT_FOUND");
    expect(DomainError.of("PHOTO_INVALID").code).toBe("VALIDATION_FAILED");
    expect(DomainError.of("CHECKIN_SAVE_FAILED").code).toBe("INTERNAL");
  });
});
```

`lib/result/ResultMapper.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/gateway/ApiError";
import { Results } from "./Result";
import { ResultMapper } from "./ResultMapper";

describe("ResultMapper.orThrow", () => {
  it("returns the value of an ok result", () => {
    expect(ResultMapper.orThrow(Results.ok({ id: "a" }))).toEqual({ id: "a" });
  });

  it("throws an ApiError carrying the code, message and reason of a failed result", () => {
    let thrown: unknown;
    try {
      ResultMapper.orThrow(Results.fail("CHECKIN_NOT_FOUND"));
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(ApiError);
    const api = thrown as ApiError;
    expect(api.code).toBe("NOT_FOUND");
    expect(api.message).toBe("Check-in not found");
    expect(api.reason).toBe("CHECKIN_NOT_FOUND");
  });
});
```

`lib/gateway/ErrorEnvelope.test.ts` (add if the file does not exist; otherwise append):

```ts
import { describe, expect, it } from "vitest";
import { ApiError } from "./ApiError";
import { ErrorEnvelope } from "./ErrorEnvelope";

describe("ErrorEnvelope reason", () => {
  it("includes the reason in the body and the action failure when the error has one", () => {
    const error = new ApiError("NOT_FOUND", "Check-in not found", undefined, undefined, "CHECKIN_NOT_FOUND");
    expect(ErrorEnvelope.body(error).error.reason).toBe("CHECKIN_NOT_FOUND");
    expect(ErrorEnvelope.actionFailure(error).reason).toBe("CHECKIN_NOT_FOUND");
  });

  it("omits the reason when there is none, so existing envelopes are unchanged", () => {
    const error = ApiError.notFound("Nope");
    expect("reason" in ErrorEnvelope.body(error).error).toBe(false);
    expect("reason" in ErrorEnvelope.actionFailure(error)).toBe(false);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `docker exec birava-app npx vitest run --project unit lib/result lib/gateway/ErrorEnvelope.test.ts`
Expected: FAIL with "Cannot find module './DomainError'" and "reason" being undefined.

- [ ] **Step 3: Implement**

`lib/result/DomainError.ts`:

```ts
import type { ErrorCode } from "@/lib/gateway/ErrorCode";

/**
 * The closed list of reasons a command can refuse for, beyond the generic
 * transport codes. Clients may switch on these; adding one is a reviewed change.
 */
export const DOMAIN_REASONS = [
  "PHOTO_INVALID",
  "CHECKIN_NOT_FOUND",
  "CHECKIN_SAVE_FAILED",
  "CHECKIN_UPDATE_FAILED",
  "CHECKIN_DELETE_FAILED",
] as const;

export type DomainReason = (typeof DOMAIN_REASONS)[number];

type Entry = { code: ErrorCode; message: string };

/** An expected, named refusal. Reasons map to a transport code here, once, and to default copy. */
export class DomainError {
  private static readonly TABLE: Record<DomainReason, Entry> = {
    PHOTO_INVALID: { code: "VALIDATION_FAILED", message: "That photo isn't valid. Pick it again." },
    CHECKIN_NOT_FOUND: { code: "NOT_FOUND", message: "Check-in not found" },
    CHECKIN_SAVE_FAILED: { code: "INTERNAL", message: "Failed to save check-in." },
    CHECKIN_UPDATE_FAILED: { code: "INTERNAL", message: "Failed to update check-in." },
    CHECKIN_DELETE_FAILED: { code: "INTERNAL", message: "Failed to delete check-in." },
  };

  private constructor(
    readonly reason: DomainReason,
    readonly code: ErrorCode,
    readonly message: string
  ) {}

  static of(reason: DomainReason, message?: string): DomainError {
    const entry = DomainError.TABLE[reason];
    return new DomainError(reason, entry.code, message ?? entry.message);
  }
}
```

`lib/result/Result.ts`:

```ts
import { DomainError, type DomainReason } from "./DomainError";

export type Result<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: DomainError };

export class Results {
  static ok<T>(value: T): Result<T> {
    return { ok: true, value };
  }

  static fail<T = never>(reason: DomainReason, message?: string): Result<T> {
    return { ok: false, error: DomainError.of(reason, message) };
  }
}
```

`lib/result/ResultMapper.ts`:

```ts
import { ApiError } from "@/lib/gateway/ApiError";
import type { Result } from "./Result";

export class ResultMapper {
  /** The value of an ok result; a failed one becomes the gateway's ApiError (with its reason), which the web and v1 adapters already render. */
  static orThrow<T>(result: Result<T>): T {
    if (result.ok) return result.value;
    const { code, message, reason } = result.error;
    throw new ApiError(code, message, undefined, undefined, reason);
  }
}
```

In `lib/gateway/ApiError.ts` add a fifth constructor parameter and field (keep all existing factories unchanged):

```ts
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly fields?: FieldErrors,
    /** Seconds to wait; sent as `Retry-After` for RATE_LIMITED. */
    readonly retryAfterSeconds?: number,
    /** A stable, domain-specific reason (see lib/result/DomainError.ts) a client may switch on. */
    readonly reason?: string
  ) {
```

In `lib/gateway/ErrorEnvelope.ts` extend both shapes and builders:

```ts
export type ErrorEnvelopeBody = {
  error: { code: ErrorCode; message: string; fields?: FieldErrors; reason?: string };
};

export type ActionFailure = {
  error: string;
  code: ErrorCode;
  fields?: FieldErrors;
  reason?: string;
};
```

and in `body(...)` add `...(error.reason ? { reason: error.reason } : {})` inside the `error` object, and in `actionFailure(...)` add `...(error.reason ? { reason: error.reason } : {})`.

- [ ] **Step 4: Run tests and typecheck to verify they pass**

Run: `docker exec birava-app npx vitest run --project unit lib/result lib/gateway && docker exec birava-app npx tsc --noEmit`
Expected: PASS, no type errors. If `Gateway.test.ts` fails on a strict-equal envelope, the reason must be omitted when absent (it is); fix the implementation, not the test.

- [ ] **Step 5: Commit**

```bash
git add lib/result lib/gateway/ApiError.ts lib/gateway/ErrorEnvelope.ts lib/gateway/ErrorEnvelope.test.ts
git commit -m "feat: add DomainError, Result and ResultMapper with a reason on the error envelope"
```

---

### Task 2: Separate commit from post-commit cleanup; no silent catch in the check-in commands

**Files:**
- Modify: `modules/checkins/application/drinkEntryCommands.ts` (create ~416-424, update ~505-515, delete ~619-633)
- Test: `tests/integration/drinkEntryCommands.test.ts` (extend)

**Interfaces:**
- Consumes: `LoggerFactory.create(name)` from `lib/logging/LoggerFactory` (an `ILogger` with `error(message, context)`).
- Produces: no signature change. `createDrinkEntry`, `updateDrinkEntry`, `deleteDrinkEntry` keep returning the same DTOs; a failure after a successful commit is logged and never returned as `{ error }`.

- [ ] **Step 1: Write the failing integration tests**

Append to `tests/integration/drinkEntryCommands.test.ts` (reuse the file's existing `emptyPayload`, `actor` helpers and fixture pattern; the names below match the ones already used in that file for creating a user):

```ts
import { vi } from "vitest";
import { shareImageCache } from "@/modules/sessions";
import { drinkPhotoService } from "@/modules/media/server/photoUpload";

describe("post-commit cleanup never turns a saved check-in into a failure", () => {
  it("still succeeds when removing a stale share image throws after create", async () => {
    const user = await fixtures.createUser();
    const spy = vi.spyOn(shareImageCache, "remove").mockRejectedValue(new Error("blob down"));
    try {
      const first = await createDrinkEntry(user.id, { ...emptyPayload, createdAt: Date.now() - 60_000 }, { username: user.username, avatarUrl: null });
      expect(first.error).toBeUndefined();
      const stored = await db.drinkEntry.findUnique({ where: { id: first.id! } });
      expect(stored).not.toBeNull();
    } finally {
      spy.mockRestore();
    }
  });

  it("still succeeds when removing the photo blob throws after delete", async () => {
    const user = await fixtures.createUser();
    const created = await createDrinkEntry(user.id, { ...emptyPayload, createdAt: Date.now() - 60_000 }, { username: user.username, avatarUrl: null });
    const spy = vi.spyOn(drinkPhotoService, "remove").mockRejectedValue(new Error("blob down"));
    try {
      await db.drinkEntry.update({ where: { id: created.id! }, data: { photoUrl: `/uploads/entries-photos/${user.id}/x.webp` } });
      const result = await deleteDrinkEntry(user.id, { id: created.id! });
      expect(result.error).toBeUndefined();
      expect(await db.drinkEntry.findUnique({ where: { id: created.id! } })).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });

  it("still reports failure when the transaction itself fails", async () => {
    // A user id that does not exist violates the foreign key, so the insert (and the transaction) fails for real.
    const result = await createDrinkEntry(crypto.randomUUID(), { ...emptyPayload, createdAt: Date.now() - 60_000 }, { username: "ghost", avatarUrl: null });
    expect(result.error).toBe("Failed to save check-in.");
  });
});
```

- [ ] **Step 2: Run to verify the first two fail**

Run: `npm run test:integration -- tests/integration/drinkEntryCommands.test.ts` (host; it loads `.env.test`)
Expected: the two cleanup tests FAIL (`result.error` is `"Failed to save check-in."` for create; the delete test throws from `remove`), the third passes.

- [ ] **Step 3: Implement**

At the top of `drinkEntryCommands.ts` add:

```ts
import { LoggerFactory } from "@/lib/logging/LoggerFactory";

const logger = LoggerFactory.create("checkins");
```

Replace the create block (the `let result ... try { ... } catch` around `db.$transaction`) with:

```ts
  let result: CreateTxResult;
  try {
    result = await db.$transaction((tx) => insertCheckin(tx, userId, entryId, createdAt, input));
  } catch (error) {
    logger.error("check-in save failed", { userId, entryId, error });
    return { error: "Failed to save check-in." };
  }
  // The check-in is committed from here on. Cleanup failures are logged and never reported as a failed save.
  if (result.orphanedShareImageUrls.length > 0) {
    await Promise.allSettled(result.orphanedShareImageUrls.map((url) => shareImageCache.remove(url))).then((outcomes) => {
      for (const outcome of outcomes) {
        if (outcome.status === "rejected") logger.error("share image cleanup failed after create", { userId, entryId, error: outcome.reason });
      }
    });
  }
```

Update path: change `} catch {` to `} catch (error) { logger.error("check-in update failed", { userId, entryId: input.id, error }); return { error: "Failed to update check-in." }; }` and wrap the old-photo removal:

```ts
  if (existing.photoUrl && existing.photoUrl !== input.photoUrl) {
    try {
      await drinkPhotoService.remove(existing.photoUrl, userId);
    } catch (error) {
      logger.error("old photo cleanup failed after update", { userId, entryId: input.id, error });
    }
  }
```

Delete path: change the catch to log (`logger.error("check-in delete failed", { userId, entryId: input.id, error })`) and wrap both cleanup calls in try/catch with `logger.error("photo cleanup failed after delete", ...)` and `logger.error("share image cleanup failed after delete", ...)`, using `Promise.allSettled` for the share-image list as above. The success return stays `{ revalidatedPaths: [...] }`.

- [ ] **Step 4: Run the integration tests and typecheck**

Run: `npm run test:integration -- tests/integration/drinkEntryCommands.test.ts && docker exec birava-app npx tsc --noEmit`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add modules/checkins/application/drinkEntryCommands.ts tests/integration/drinkEntryCommands.test.ts
git commit -m "fix: log post-commit cleanup failures instead of reporting a saved check-in as failed"
```

---

### Task 3: Check-in commands return Result

**Files:**
- Modify: `modules/checkins/application/drinkEntryCommands.ts`, `modules/checkins/actions/drinkController.ts`
- Modify (call sites): `modules/checkins/actions/drinkController.test.ts`, `tests/integration/drinkEntryCommands.test.ts`, `tests/integration/dashboardFeed.test.ts`, `tests/integration/api-v1/V1World.ts`, `tests/integration/drinkSessionQueries.test.ts`, `tests/integration/actionContracts.test.ts` (only if it calls the commands directly), `e2e/support/seedBackdatedSessions.ts` (comment only)

**Interfaces:**
- Consumes: Task 1 (`Results`, `ResultMapper`, `DomainError`).
- Produces: `createDrinkEntry(...) : Promise<Result<{ id: string; achievementUnlocked: boolean; revalidatedPaths: string[] }>>`, `updateDrinkEntry(...) : Promise<Result<{ revalidatedPaths: string[] }>>`, `deleteDrinkEntry(...) : Promise<Result<{ revalidatedPaths: string[] }>>`. The delete of a non-existent or foreign entry stays an ok result with empty `revalidatedPaths` (idempotent delete, as today).

- [ ] **Step 1: Write the failing tests**

In `tests/integration/drinkEntryCommands.test.ts` rewrite the existing assertions to the new shape and add two tests. Pattern for every existing call: `const result = await createDrinkEntry(...)` becomes `const result = await createDrinkEntry(...); expect(result.ok).toBe(true); const out = result.ok ? result.value : undefined;` and `result.error`/`result.id` reads become `out`/`result.error.reason`. Add:

```ts
it("returns a typed not-found when updating another user's check-in", async () => {
  const owner = await fixtures.createUser();
  const other = await fixtures.createUser();
  const created = await createDrinkEntry(owner.id, { ...emptyPayload, createdAt: Date.now() - 60_000 }, { username: owner.username, avatarUrl: null });
  const id = created.ok ? created.value.id : "";
  const result = await updateDrinkEntry(other.id, { id, ...emptyPayload });
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error.reason).toBe("CHECKIN_NOT_FOUND");
    expect(result.error.code).toBe("NOT_FOUND");
  }
});

it("returns the original success for a replayed create with the same clientId", async () => {
  const user = await fixtures.createUser();
  const clientId = crypto.randomUUID();
  const first = await createDrinkEntry(user.id, { ...emptyPayload, clientId, createdAt: Date.now() - 60_000 }, { username: user.username, avatarUrl: null });
  const retry = await createDrinkEntry(user.id, { ...emptyPayload, clientId, createdAt: Date.now() - 60_000 }, { username: user.username, avatarUrl: null });
  expect(first.ok && retry.ok).toBe(true);
  if (first.ok && retry.ok) expect(retry.value.id).toBe(first.value.id);
});
```

Update `drinkController.test.ts` mocks to resolve `Results.ok({ ... })` instead of plain objects, and add a case where `updateDrinkEntry` resolves `Results.fail("CHECKIN_NOT_FOUND")` and the action result is `{ error: "Check-in not found", code: "NOT_FOUND", reason: "CHECKIN_NOT_FOUND" }`.

- [ ] **Step 2: Run to verify they fail**

Run: `npm run test:integration -- tests/integration/drinkEntryCommands.test.ts` and `docker exec birava-app npx vitest run --project unit modules/checkins`
Expected: FAIL (`result.ok` undefined; mapper not applied in the controller).

- [ ] **Step 3: Implement**

In `drinkEntryCommands.ts` import `Results, type Result` from `@/lib/result/Result`. Change the signatures and returns:

```ts
export async function createDrinkEntry(
  userId: string,
  input: CreateDrinkEntryDTO,
  actor: { username: string; avatarUrl: string | null }
): Promise<Result<{ id: string; achievementUnlocked: boolean; revalidatedPaths: string[] }>> {
  if (input.photoUrl && !drinkPhotoService.isIssuedUrl(input.photoUrl, userId)) {
    return Results.fail("PHOTO_INVALID");
  }
  // ... unchanged until the transaction catch:
  } catch (error) {
    logger.error("check-in save failed", { userId, entryId, error });
    return Results.fail("CHECKIN_SAVE_FAILED");
  }
  // replay:
  if (result.replay) {
    return Results.ok({ achievementUnlocked: false, id: created.id, revalidatedPaths: [`/sessions/${created.sessionId}`] });
  }
  // final return:
  return Results.ok({ achievementUnlocked: newlyEarned.length > 0, id: created.id, revalidatedPaths: [`/sessions/${created.sessionId}`] });
```

For `updateDrinkEntry`: return type `Promise<Result<{ revalidatedPaths: string[] }>>`; photo guard returns `Results.fail("PHOTO_INVALID")`; `if (!result) return Results.fail("CHECKIN_NOT_FOUND");`; the catch returns `Results.fail("CHECKIN_UPDATE_FAILED")`; success `Results.ok({ revalidatedPaths: [...] })`. For `deleteDrinkEntry`: `if (!result) return Results.ok({ revalidatedPaths: [] });`, the catch returns `Results.fail("CHECKIN_DELETE_FAILED")`, success `Results.ok({ revalidatedPaths: [...] })`. Remove the `INVALID_PHOTO_ERROR` constant (the default message lives in `DomainError`).

In `drinkController.ts` import `ResultMapper` from `@/lib/result/ResultMapper` and unwrap before the revalidation helper:

```ts
export const addDrink = gateway.action.authed(
  { name: "checkins.add", input: createCheckinInput },
  async ({ user, input }) => {
    const created = ResultMapper.orThrow(await createDrinkEntry(user.id, input, { username: user.username, avatarUrl: user.avatarUrl }));
    return applyDrinkRevalidation(user.id, created);
  }
);

export const editDrink = gateway.action.authed(
  { name: "checkins.edit", input: updateCheckinInput },
  async ({ user, input }) => applyDrinkRevalidation(user.id, ResultMapper.orThrow(await updateDrinkEntry(user.id, input)))
);

export const deleteDrink = gateway.action.authed(
  { name: "checkins.delete", input: deleteCheckinInput },
  async ({ user, input }) => applyDrinkRevalidation(user.id, ResultMapper.orThrow(await deleteDrinkEntry(user.id, input)))
);
```

`applyDrinkRevalidation`'s generic keeps working because the unwrapped values carry `revalidatedPaths` (its `error?` constraint is satisfied by an absent field). The ActionGateway already converts the thrown `ApiError` into `{ error, code, reason }`, so the web UI still reads `result.error`. In every direct test caller (`V1World.ts`, `dashboardFeed.test.ts`, `drinkSessionQueries.test.ts`) replace `result.id`/`result.error` with a small helper from a new `tests/integration/support/unwrapResult.ts`:

```ts
import type { Result } from "@/lib/result/Result";

export class TestResults {
  static value<T>(result: Result<T>): T {
    if (!result.ok) throw new Error(`${result.error.reason}: ${result.error.message}`);
    return result.value;
  }
}
```

so `const entry = TestResults.value(await createDrinkEntry(...))` replaces `if (result.error) throw ...; ... result.id!`.

- [ ] **Step 4: Run everything that touches the commands**

Run: `docker exec birava-app npx tsc --noEmit && docker exec birava-app npx vitest run --project unit modules/checkins lib && npm run test:integration && docker exec birava-app npm run depcruise`
Expected: PASS everywhere, including `tests/integration/api-v1/*` (v1 reads the same failure shape: `{ error, code }` plus the new `reason`) and `gatewayCoverage.test.ts`.
If an api-v1 contract test snapshots the error envelope, update it to include `reason` for refusals that now have one, and regenerate the OpenAPI document if the schema test requires it.

- [ ] **Step 5: Commit**

```bash
git add modules/checkins tests e2e/support/seedBackdatedSessions.ts lib/result
git commit -m "refactor: check-in commands return typed Results mapped to the gateway at the edge"
```

---

## Self-Review

- **Spec coverage:** Epic 1's "Result and typed DomainError (foundation, checkins)" (#458) is Tasks 1 and 3; "no log-less catch; separate commit from post-commit cleanup" (#460) is Task 2 for the check-in commands. The other 38 bare catches, the other modules' string results (#459) and the ESLint rule that forbids new ones are deliberately in plan 1c, because each needs the module's own code read first; the Task 1 types are the shared foundation they use. Clock and time zone (#461) is plan 1b.
- **Placeholders:** none; every code step shows the code. The one lookup the executor must do is that `drinkEntryCommands.test.ts` already defines `fixtures`, `emptyPayload` and `db`; if the names differ, use the file's own.
- **Type consistency:** `DomainReason`, `DomainError.of`, `Results.ok/fail`, `ResultMapper.orThrow`, `TestResults.value` and the `reason` field are defined in Task 1 or Task 3 and used with the same names afterwards.
- **Review Focus:** each line maps to a test: cleanup failures (Task 2, tests 1 and 2), real transaction failure (Task 2, test 3), foreign update (Task 3), replay (Task 3), unmapped reason fails the build (Task 1, `Record<DomainReason, Entry>` makes a missing entry a type error and the first test iterates the list).
