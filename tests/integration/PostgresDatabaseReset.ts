import { Prisma, type PrismaClient } from "@prisma/client";
import type { IDatabaseReset } from "./IDatabaseReset";

/**
 * Truncates every Prisma-managed table via a single statement (`CASCADE`
 * handles foreign-key ordering regardless of declaration order). Table
 * names are read from Prisma's own DMMF rather than hardcoded, so this
 * stays correct as models are added/removed without needing an update here.
 */
export class PostgresDatabaseReset implements IDatabaseReset {
  constructor(private readonly db: PrismaClient) {}

  async reset(): Promise<void> {
    const tables = Prisma.dmmf.datamodel.models.map((model) => `"${model.dbName ?? model.name}"`);
    if (tables.length === 0) return;

    await this.db.$executeRawUnsafe(`TRUNCATE TABLE ${tables.join(", ")} RESTART IDENTITY CASCADE;`);
  }
}
