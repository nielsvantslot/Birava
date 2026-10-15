/**
 * The migration gate (npm run migrations:check). Turns the manual full-data
 * rehearsal habit into a check that runs on every pull request touching
 * prisma/ (.github/workflows/migration-check.yml):
 *
 *   1. Destructive statements in the migrations the PR adds (DROP COLUMN,
 *      DROP TABLE, a column type change, ...) fail the check unless the PR is
 *      labelled destructive-migration-reviewed (--allow-destructive).
 *   2. Every migration applies to an empty database, and the migrated schema
 *      equals prisma/schema.prisma (`prisma migrate diff`).
 *   3. Upgrade rehearsal: a database is built exactly as the base branch has
 *      it (a worktree of the base ref, its own migrations, its own demo seed),
 *      then this branch's new migrations are applied on top. No table that
 *      existed before may lose rows, and the result must equal the schema too.
 *
 * Usage:  tsx scripts/check-migrations.ts --base origin/dev [--allow-destructive]
 * Needs:  MIGRATION_CHECK_ADMIN_URL, a Postgres URL that may CREATE DATABASE
 *         (for example postgresql://user:pass@localhost:5432/postgres).
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { DestructiveStatementScanner } from "../lib/migrations/DestructiveStatementScanner";

class MigrationCheck {
  private readonly cleanup: (() => void)[] = [];

  constructor(
    private readonly adminUrl: string,
    private readonly baseRef: string,
    private readonly allowDestructive: boolean
  ) {}

  async run(): Promise<void> {
    try {
      this.checkDestructive();
      await this.checkEmptyDatabase();
      await this.checkUpgradeFromBase();
      console.log("\nMigration check passed.");
    } finally {
      for (const undo of this.cleanup.reverse()) undo();
    }
  }

  // 1 ------------------------------------------------------------------

  private checkDestructive(): void {
    step("Looking for destructive statements in the new migrations");
    const files = this.git(["diff", "--name-only", "--diff-filter=AM", `${this.baseRef}...HEAD`, "--", "prisma/migrations"])
      .split("\n")
      .filter((f) => f.endsWith("migration.sql"));
    if (files.length === 0) {
      console.log("No new migrations.");
      return;
    }

    const violations = files.flatMap((file) =>
      DestructiveStatementScanner.scan(readFileSync(file, "utf8")).map((found) => ({ file, ...found }))
    );

    console.log(`${files.length} new migration(s): ${files.join(", ")}`);
    if (violations.length === 0) return;

    for (const v of violations) console.log(`  ! ${v.file}: ${v.why}\n      ${v.statement}`);
    if (!this.allowDestructive) {
      throw new Error(
        "Destructive migration statements need an explicit review. Rewrite the change as expand/contract, or, once a human has " +
          "checked it against realistic data, add the destructive-migration-reviewed label to the pull request."
      );
    }
    console.log("Allowed: the pull request carries the destructive-migration-reviewed label.");
  }

  // 2 ------------------------------------------------------------------

  private async checkEmptyDatabase(): Promise<void> {
    step("Applying every migration to an empty database");
    const url = await this.createDatabase("mc_empty");
    this.prisma(["migrate", "deploy"], process.cwd(), url);

    step("Checking the migrated schema equals prisma/schema.prisma");
    this.assertNoSchemaDrift(url, process.cwd());
  }

  // 3 ------------------------------------------------------------------

  private async checkUpgradeFromBase(): Promise<void> {
    step(`Building the baseline: ${this.baseRef} with its own migrations and demo seed`);
    const worktree = join(mkdtempSync(join(tmpdir(), "mc-base-")), "base");
    this.git(["worktree", "add", "--detach", worktree, this.baseRef]);
    this.cleanup.push(() => {
      this.git(["worktree", "remove", "--force", worktree]);
      rmSync(join(worktree, ".."), { recursive: true, force: true });
    });

    const url = await this.createDatabase("mc_upgrade");
    run("npm", ["ci", "--no-audit", "--no-fund"], worktree, { DATABASE_URL: url });
    this.prisma(["migrate", "deploy"], worktree, url);
    run("npx", ["tsx", "prisma/seed.ts"], worktree, { DATABASE_URL: url, SEED_DEMO: "true" });

    const before = await this.rowCounts(url);
    const columnsBefore = await this.columns(url);
    const seeded = Object.values(before).reduce((a, b) => a + b, 0);
    console.log(`Baseline has ${Object.keys(before).length} tables and ${seeded} rows.`);
    if (seeded === 0) throw new Error("The baseline seed produced no rows, so this rehearsal would prove nothing.");

    step("Applying this branch's migrations on top of the baseline");
    this.prisma(["migrate", "deploy"], process.cwd(), url);

    const after = await this.rowCounts(url);
    const lost = Object.entries(before).filter(([table, count]) => table in after && after[table]! < count);
    if (lost.length > 0) {
      throw new Error(`Rows were lost in the upgrade: ${lost.map(([t, c]) => `${t} ${c} -> ${after[t]}`).join(", ")}`);
    }
    // Row counts can't see a column that was dropped and recreated (the Prisma type-change footgun), so compare the columns too.
    const columnsAfter = await this.columns(url);
    const removed = [
      ...Object.keys(before).filter((table) => !(table in after)).map((table) => `table ${table}`),
      ...Object.entries(columnsBefore).flatMap(([table, cols]) =>
        table in columnsAfter ? [...cols].filter((c) => !columnsAfter[table]!.has(c)).map((c) => `column ${table}.${c}`) : []
      ),
    ];
    if (removed.length > 0) {
      console.log(`Removed by the upgrade: ${removed.join(", ")}`);
      if (!this.allowDestructive) {
        throw new Error("The upgrade removes tables or columns that existed in the baseline. If that is intended (the contract step of expand/contract), a human reviews it and adds the destructive-migration-reviewed label.");
      }
    }

    step("Checking the upgraded schema equals prisma/schema.prisma");
    this.assertNoSchemaDrift(url, process.cwd());
  }

  // helpers ------------------------------------------------------------

  private assertNoSchemaDrift(databaseUrl: string, cwd: string): void {
    try {
      run("npx", ["prisma", "migrate", "diff", "--from-url", databaseUrl, "--to-schema-datamodel", "prisma/schema.prisma", "--exit-code"], cwd);
    } catch {
      throw new Error("The migrated database does not match prisma/schema.prisma: a migration is missing or wrong (see the diff above).");
    }
  }

  private prisma(args: string[], cwd: string, databaseUrl: string): void {
    run("npx", ["prisma", ...args], cwd, { DATABASE_URL: databaseUrl });
  }

  private git(args: string[]): string {
    return execFileSync("git", args, { encoding: "utf8" }).trim();
  }

  private async createDatabase(name: string): Promise<string> {
    const admin = new PrismaClient({ datasourceUrl: this.adminUrl });
    try {
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await admin.$executeRawUnsafe(`CREATE DATABASE ${name}`);
    } finally {
      await admin.$disconnect();
    }
    this.cleanup.push(() => void dropQuietly(this.adminUrl, name));
    return withDatabase(this.adminUrl, name);
  }

  private async columns(databaseUrl: string): Promise<Record<string, Set<string>>> {
    const client = new PrismaClient({ datasourceUrl: databaseUrl });
    try {
      const rows = await client.$queryRaw<{ table_name: string; column_name: string }[]>`
        SELECT table_name, column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name <> '_prisma_migrations'`;
      const byTable: Record<string, Set<string>> = {};
      for (const { table_name, column_name } of rows) (byTable[table_name] ??= new Set()).add(column_name);
      return byTable;
    } finally {
      await client.$disconnect();
    }
  }

  private async rowCounts(databaseUrl: string): Promise<Record<string, number>> {
    const client = new PrismaClient({ datasourceUrl: databaseUrl });
    try {
      const tables = await client.$queryRaw<{ table_name: string }[]>`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations'`;
      const counts: Record<string, number> = {};
      for (const { table_name } of tables) {
        const [row] = await client.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM "${table_name}"`);
        counts[table_name] = Number(row?.n ?? 0);
      }
      return counts;
    } finally {
      await client.$disconnect();
    }
  }
}

function withDatabase(url: string, name: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

async function dropQuietly(adminUrl: string, name: string): Promise<void> {
  const admin = new PrismaClient({ datasourceUrl: adminUrl });
  try {
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  } catch {
    // Best effort: a leftover scratch database on a CI runner or local container is harmless.
  } finally {
    await admin.$disconnect();
  }
}

function run(command: string, args: string[], cwd: string = process.cwd(), env: Record<string, string> = {}): void {
  execFileSync(command, args, { cwd, stdio: "inherit", env: { ...process.env, ...env }, shell: process.platform === "win32" });
}

function step(title: string): void {
  console.log(`\n== ${title}`);
}

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main(): Promise<void> {
  const adminUrl = process.env.MIGRATION_CHECK_ADMIN_URL;
  const baseRef = option("--base");
  if (!adminUrl || !baseRef) {
    console.error("Usage: MIGRATION_CHECK_ADMIN_URL=<postgres url> tsx scripts/check-migrations.ts --base <ref> [--allow-destructive]");
    process.exit(2);
  }

  try {
    await new MigrationCheck(adminUrl, baseRef, process.argv.includes("--allow-destructive")).run();
  } catch (error) {
    console.error(`\nMigration check failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

void main();
