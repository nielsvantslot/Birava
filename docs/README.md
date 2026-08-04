# Birava docs

Centralized index for this repo's documentation. Synced to GitBook per branch via Git Sync, so this same content renders separately for `dev`, `staging`, and `main` — whichever space you're reading, you're seeing that branch's docs, not a stale snapshot.

## Architecture

- [Backend architecture](architecture.md) — layered request flow, the direct-to-Blob upload sequence, scheduled jobs, and the boundaries that keep the layers from collapsing into each other. **Keep this current** — a diagram that no longer matches the code is a bug, not just stale docs.

## Audit reports

Point-in-time snapshots, not living docs — each records the commit it was taken against.

- [Product & UX audit — 2026-07-09](audit/birava-audit-2026-07-09.md)
- [Technical audit — 2026-07-09](audit/birava-tech-audit-2026-07-09.md)
- [Performance & load-speed audit — 2026-07-10](audit/birava-perf-audit-2026-07-10.md)

## Feature specs

- [Header cleanup + session share card — 2026-07-14](superpowers/specs/2026-07-14-header-cleanup-session-share-design.md)

## Elsewhere in this repo

Not moved here — these serve a different purpose or are expected at the repo root by tooling/convention, but they're documentation too:

- [`CLAUDE.md`](../CLAUDE.md) — guidance for Claude Code / AI-assisted work in this repo
- [`AGENTS.md`](../AGENTS.md) — same purpose, for other agent tooling
- [`HANDOFF.md`](../HANDOFF.md) — the running Birava 2.0 handoff log
- [`README.md`](../README.md) — repo setup/run instructions
