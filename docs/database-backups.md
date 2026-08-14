# Database backups

Recovery, not prevention: `vercel.json` runs `prisma migrate deploy`
unattended on every push to `staging`/`main`, with no gate on destructive
migrations by design (a CI block was tried and explicitly rejected — the
ask here is "give us a rollback path," not "stop us from deploying"). These
layers exist so a bad migration or query is *recoverable*, not so it can
never happen. None cost money at this app's scale.

## Layer 1 — Neon point-in-time restore (already on, no setup)

Neon's Free plan keeps a rolling **6-hour** history of the production
branch and can restore/branch to any point inside it, no `pg_restore`
needed. This is the fast path for "I just ran a bad migration/query" —
Neon dashboard → the production branch → Restore.

**It is not a real backup strategy on its own**: the window is only 6
hours, capped at 1GB of changes, and it disappears if the Neon project
itself is ever deleted or the account lost. That's what layer 2 is for.

## Layer 2 — Nightly encrypted logical backup (`.github/workflows/db-backup.yml`)

A GitHub Actions cron (same pattern as `session-reminders.yml` /
`cleanup-orphaned-blobs.yml`) that, once a day:

1. `pg_dump`s the production database (custom format) using a **direct**
   (non-pooled) connection string — Neon requires this for `pg_dump`. Run
   via `postgres:18-alpine` — Neon's dashboard confirms the project runs
   Postgres 18 (unrelated to `ci.yml`'s `postgres:16-alpine` test DB, which
   only tracks this repo's own Prisma schema target — check the Neon
   dashboard again before assuming this still matches after any Neon
   upgrade). `pg_dump`/`pg_restore` must be >= the server's major version
   or they can silently mishandle newer catalog features.
2. Sanity-checks the dump isn't suspiciously small before trusting it.
3. Encrypts it client-side with GPG (AES256, symmetric passphrase) — the
   dump contains real PII (emails, check-in GPS coordinates), so it should
   never be readable from raw storage contents alone.
4. Uploads it to **Vercel Blob** (`scripts/backup-database.ts`, under
   `db-backups/`) — the same store this app already uses for photos.

**Why Vercel Blob, not a separate provider (e.g. Backblaze B2)**: the risk
this guards against — a bad migration wiping Neon data — has nothing to do
with Vercel, so Blob already provides real isolation from it, at zero new
signups (reuses the existing `BLOB_READ_WRITE_TOKEN`). The trade-off,
accepted deliberately: this does **not** protect against a Vercel-account-
level incident (compromise, suspension, billing lockout) taking down the
app and its backups together. That's a known, accepted gap at this
project's scale — revisit if the app ever depends on backups surviving a
Vercel-specific catastrophe, not just a database one.

**Retention** (`lib/backupRetention.ts`, unit-tested) is computed in code
and applied by the same script right after each upload — one grandfather-
father-son scheme, one copy per day (not physically duplicated per tier):

| Kept while...                          | Window     | Effect                          |
| --------------------------------------- | ---------- | -------------------------------- |
| any backup                              | 14 days    | every day in the last 2 weeks    |
| Monday's backup                         | 90 days    | every week in the last ~3 months |
| the 1st-of-month backup                 | 400 days   | every month in the last ~13 months |

Cadence is deliberately daily, not finer — Neon's PITR (layer 1) already
covers the last 6 hours at second granularity, so anything more frequent
here would just duplicate that for extra cost with no added protection.

Only production is backed up. Staging is exempt on purpose — its data is
disposable (seeded demo accounts, throwaway test data).

**GDPR erasure vs. this retention schedule** — a deliberate, documented
trade-off, not an oversight: account deletion
(`lib/commands/userCommands.ts`'s `requestAccountDeletion`/
`purgeExpiredDeletedAccounts`) removes a user's data from every live system
completely and immediately once the grace period ends. It does **not**
reach into these encrypted nightly dumps — a deleted user's data can still
exist inside a backup for up to 400 days after deletion, per the retention
table above. Scrubbing individual users out of already-encrypted backups
(or out of a backup only if/when it's ever restored) was considered and
rejected as disproportionate engineering for this app's scale; the accepted
position is that live-system erasure plus this bounded, disclosed retention
window is a legitimate technical constraint on the right to erasure, the
same way any backup system already is at every company that has one.

## Layer 3 — Monthly restore drill (`.github/workflows/restore-drill.yml`)

**Untested backups are a hypothesis, not a backup.** Once a month:

1. Creates a **schema-only** Neon branch (`neondatabase/create-branch-action`)
   — same schema as production, but genuinely zero rows and no shared
   history with the parent. Deliberately not a normal branch: a normal
   branch is an instant copy-on-write of production's *current* data, which
   would make the drill meaningless (the branch would already have fresher
   data than the backup before `pg_restore` ever ran).
2. Downloads the most recent backup from Blob (`scripts/download-latest-backup.ts`)
   and decrypts it.
3. `pg_restore`s it into the empty scratch branch.
4. Runs `scripts/verify-restore.ts` — confirms `User`/`DrinkEntry`/`DrinkSession`
   actually have rows, i.e. the backup file alone was enough to recreate
   real data.
5. Deletes the scratch branch (`neondatabase/delete-branch-action`), with a
   Neon-side `expires_at` set as a backstop in case the job dies before
   that step runs.

## One-time setup (manual — needs a human with account access)

1. **Neon**: dashboard → production branch → Connection Details → copy the
   **direct** connection string (not the pooled `-pooler` one). Also grab
   your **project ID** (dashboard URL or Settings → General) and generate
   an **API key** (Account Settings → API Keys) — needed only for the
   restore drill's branch create/delete, not the nightly backup itself.
2. **Vercel Blob**: nothing new — copy the existing `BLOB_READ_WRITE_TOKEN`
   value from the Vercel project's environment variables.
3. **GitHub secrets** (repo → Settings → Secrets and variables → Actions):
   - `PROD_DATABASE_URL_DIRECT` — the Neon direct connection string
   - `BLOB_READ_WRITE_TOKEN` — same value as the Vercel env var
   - `BACKUP_ENCRYPTION_KEY` — a long random passphrase (e.g.
     `openssl rand -base64 32`), stored **only** here and in a password
     manager — losing it makes every backup permanently unreadable
   - `NEON_PROJECT_ID` — for the restore drill
   - `NEON_API_KEY` — for the restore drill
4. **GitHub variable** (Settings → Secrets and variables → Actions →
   Variables), optional: `NEON_PRODUCTION_BRANCH` — only needed if
   production isn't Neon's default branch; the restore drill's
   `parent_branch` falls back to the project default when unset.

Once the first three secrets exist, `db-backup.yml` runs nightly on its
own — trigger it manually via Actions → "Database backup" → Run workflow
to test it right after setup. Once all five secrets exist, `restore-drill.yml`
can also run (manually trigger it once immediately, don't wait for the
schedule, to confirm the whole chain actually works before trusting it).

## Restoring a backup for real (`scripts/restore-backup.ts`)

This is the tool for an actual incident, not the drill above — it's the
same download → decrypt → `pg_restore` → verify chain, but pointed at
whatever target you give it, with a confirmation gate in front so a typo
in an env var can't silently overwrite the wrong database.

Requires locally: **Docker** (for a version-matched `pg_restore`, same
reasoning as `db-backup.yml`) and **gpg** (any modern version — no
version-matching concern there).

```bash
# See what's available before picking one
BLOB_READ_WRITE_TOKEN=... npm run restore:backup -- --list

# Restore the latest backup into a target database
BLOB_READ_WRITE_TOKEN=... \
BACKUP_ENCRYPTION_KEY=... \
RESTORE_TARGET_DATABASE_URL="postgresql://...<the new/empty target>..." \
npm run restore:backup

# Or restore a specific (older) backup instead of the latest
npm run restore:backup -- --backup db-backups/2026-07-01T03-17-00Z.dump.gpg
```

It prints exactly which backup and which target (password redacted) before
doing anything, and requires typing `RESTORE` to proceed (skip with `--yes`
for scripted use). On success it prints the row counts it verified and the
remaining manual steps — restore into a **new/empty Neon branch**, never
directly overwrite a still-reachable production, so you can verify before
committing:

1. Point the app's `DATABASE_URL` (Vercel env vars) at the restored target.
2. Update `PROD_DATABASE_URL_DIRECT` in GitHub secrets if the target is new,
   so tonight's backup job targets the right database again.
3. Redeploy and spot-check the app before considering the incident over.

