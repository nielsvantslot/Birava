# ADR 0001: Module map and dependency rules

- Status: accepted (2026-10-15)
- Context: Birava v2, phase 1 (boundaries), issue #344

## Context

Application code grew in type-based folders (`lib/commands`, `lib/queries`, `lib/controllers`, `lib/mappers`, `lib/dtos`) plus about 40 loose files in `lib/`. Nothing stops a pure scoring function from importing Prisma, or a component from reaching into another feature's queries. Later phases (one validated gateway, repositories, a public `/api/v1`) need clear seams, and a seam only holds when tooling enforces it.

## Decision

Feature code lives in **modules** under `modules/`. Each module has up to four folders and one public entry point.

```
modules/<name>/
  index.ts          public server-side API (re-exports from application)
  contract/         types and DTOs other modules and the UI may depend on
  domain/           pure rules; no I/O, no framework
  application/      commands, queries' orchestration, server actions; use cases
  infrastructure/   Prisma queries, mappers, adapters, vendor SDKs, rendering
```

### Modules

| Module | Owns |
| --- | --- |
| `checkins` | logging a drink (create, edit, delete), the check-in controller, the offline outbox |
| `sessions` | session grouping, the stored `DrinkSession`, session reads, share image and map |
| `venues` | venue matching and resolution of a typed name or coordinates to a `Venue` |
| `crews` | crews, invites, membership, since-joined scoring |
| `social` | cheers, comments, follows |
| `identity` | login sessions, passwords, users and profiles, account deletion, rate limiting |
| `media` | photo and avatar pipeline composition roots, blob access, orphan cleanup |
| `notifications` | in-app notifications, web push, session reminders and their cadence |
| `achievements` | achievement rules and the award ledger |
| `diagnostics` | client error log |

`modules/photo-upload` is the portable, Birava-agnostic upload engine. It is a library, not a feature module: it imports nothing Birava-specific and keeps its current layout.

### Shared kernel

`lib/` is the **platform and shared kernel**, not a feature home. It holds `db`, `env`, `logging`, `http`, `security`, `validation`, `format`, `dates`, `timezone`, `utils`, `version`, the service-worker helpers, backup tooling, and, until phase 2 replaces them with per-module zod contracts, `lib/types.ts`, `lib/dtos/` and `lib/mappers/`. No feature behaviour is added to the `lib/` root.

### Import rules

These are encoded in `.dependency-cruiser.cjs` (CI) and in ESLint `no-restricted-imports` (editor feedback).

1. **domain** imports only: its own module's `domain/`, other modules' `contract/` and `domain/`, `lib/types`, `lib/dates`, `lib/utils`, and plain npm packages. It never imports `@prisma/client`, `next`, `next/*`, `react`, `react-dom`, any `application/` or `infrastructure/` folder, `app/` or `components/`.
2. **infrastructure** never imports `application/`, `app/` or `components/`.
3. **application** never imports `app/` or `components/`, and never `react`.
4. **Cross-module imports** go only through `modules/<name>` (the index), `modules/<name>/contract/**` or `modules/<name>/domain/**`. Reaching into another module's `application/` or `infrastructure/` is a violation.
5. **`app/` and `components/`** follow rule 4, and may import `lib/` platform files. Client components import `contract/` and `domain/` only, because the index is server-side only.
6. **`lib/` never imports `modules/`**, with `modules/photo-upload` as the single exception while the composition roots finish moving.
7. **`modules/photo-upload` imports nothing outside itself** except npm packages.
8. **No circular dependencies**, anywhere.
9. `components/` never imports `lib/db`, `lib/auth/**` or any `infrastructure/`. (`server-only` guards were rejected: `tsx` scripts and the integration tests import `lib/db` outside Next, where that package throws.)

### Public surface and client safety

The index is server-side only on purpose: a barrel that mixes Prisma-backed commands with client-safe helpers would drag the database into client bundles. Pure helpers that client components need (session grouping, date maths, achievement rules) are imported from `domain/`, which rule 1 keeps free of framework code.

## Rollout

1. Tooling lands first (#345). Before any file moves, the rules are satisfied vacuously, so the baseline is empty and CI fails on any violation from day one. If a move introduces a violation that cannot be fixed in the same change, it is recorded in a `.dependency-cruiser-known-violations.json` baseline and burnt down.
2. Files move module by module with `git mv`, no logic changes (#346).
3. Pure code moves into `domain/` and is lint-enforced framework-free (#347).
4. The baseline is burnt down to zero; phase gate: zero violations on `main`.

## Consequences

- A new file has one obvious home, and a wrong import fails CI instead of surviving review.
- Moves are mechanical but touch many import paths; each module moves in its own commit to keep history bisectable.
- `lib/dtos` and `lib/mappers` stay shared until phase 2, so some cross-module coupling is baselined rather than solved here.
