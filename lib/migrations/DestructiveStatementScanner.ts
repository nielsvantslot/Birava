export type DestructiveStatement = { statement: string; why: string };

const DESTRUCTIVE: { pattern: RegExp; why: string }[] = [
  { pattern: /\bdrop\s+column\b/i, why: "drops a column and the data in it" },
  { pattern: /\bdrop\s+table\b/i, why: "drops a table and its data" },
  { pattern: /\bdrop\s+type\b/i, why: "drops a type" },
  { pattern: /\bdrop\s+schema\b/i, why: "drops a schema and everything in it" },
  { pattern: /\balter\s+column\b[^;]*\btype\b/i, why: "changes a column's type (Prisma's generated version can drop and recreate it, resetting values)" },
  { pattern: /\btruncate\b/i, why: "empties a table" },
  { pattern: /\bdelete\s+from\b/i, why: "deletes rows" },
];

/** Finds the statements in a migration that can lose data, so a human reviews them before they run unattended on deploy. */
export class DestructiveStatementScanner {
  static scan(sql: string): DestructiveStatement[] {
    // Blank out string literals first, so a ";" or "--" inside one can't split or hide a statement, and a word in a
    // literal (a default of 'type', a comment string) can't trigger a false positive.
    const withoutLiterals = sql.replace(/'(?:[^']|'')*'/g, "''");
    const withoutComments = withoutLiterals.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    const found: DestructiveStatement[] = [];
    for (const statement of withoutComments.split(";").map((s) => s.trim()).filter(Boolean)) {
      for (const { pattern, why } of DESTRUCTIVE) {
        if (pattern.test(statement)) found.push({ statement: statement.replace(/\s+/g, " ").slice(0, 160), why });
      }
    }
    return found;
  }
}
