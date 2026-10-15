import { describe, expect, it } from "vitest";
import { DestructiveStatementScanner } from "./DestructiveStatementScanner";

describe("DestructiveStatementScanner", () => {
  it("lets additive migrations through", () => {
    const sql = `
      -- CreateTable
      CREATE TABLE "Thing" ("id" UUID NOT NULL, CONSTRAINT "Thing_pkey" PRIMARY KEY ("id"));
      ALTER TABLE "User" ADD COLUMN "nickname" TEXT;
      CREATE INDEX "Thing_id_idx" ON "Thing"("id");
      ALTER TABLE "Thing" ADD CONSTRAINT "Thing_fk" FOREIGN KEY ("id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;`;

    expect(DestructiveStatementScanner.scan(sql)).toEqual([]);
  });

  it("flags dropped columns, tables and types", () => {
    const found = DestructiveStatementScanner.scan(`
      ALTER TABLE "DrinkEntry" DROP COLUMN "notes";
      DROP TABLE "Legacy";
      DROP TYPE "OldEnum";`);

    expect(found.map((f) => f.why)).toEqual(["drops a column and the data in it", "drops a table and its data", "drops a type"]);
  });

  it("flags a column type change, the shape Prisma generates as a silent drop and recreate", () => {
    const found = DestructiveStatementScanner.scan(`ALTER TABLE "DrinkEntry" ALTER COLUMN "drinkType" TYPE "DrinkType" USING ("drinkType"::"DrinkType");`);

    expect(found).toHaveLength(1);
    expect(found[0]?.why).toContain("type");
  });

  it("flags statements that delete or empty data, but not ON DELETE CASCADE", () => {
    expect(DestructiveStatementScanner.scan(`DELETE FROM "Session" WHERE "expiresAt" < now();`)).toHaveLength(1);
    expect(DestructiveStatementScanner.scan(`TRUNCATE TABLE "RateLimitBucket";`)).toHaveLength(1);
    expect(DestructiveStatementScanner.scan(`ALTER TABLE "A" ADD CONSTRAINT "x" FOREIGN KEY ("b") REFERENCES "B"("id") ON DELETE CASCADE;`)).toEqual([]);
  });

  it("ignores what is only mentioned in a comment", () => {
    expect(DestructiveStatementScanner.scan(`-- we used to DROP COLUMN "notes" here\nALTER TABLE "A" ADD COLUMN "b" TEXT;`)).toEqual([]);
  });
});
