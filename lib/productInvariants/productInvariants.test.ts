import { describe, expect, it } from "vitest";
import { SourceScanner } from "@/lib/productInvariants/SourceScanner";

/**
 * The Birava 2.0 product invariants from CLAUDE.md, made executable so a
 * breach fails CI instead of relying on a reviewer remembering them. Only
 * rules that can be checked statically live here; accent discipline for
 * "the current user's own data" still needs a human or a visual test.
 */
const scanner = new SourceScanner();
const UI_FOLDERS = ["app", "components"];
const COPY_FILES = [
  ...scanner.list(UI_FOLDERS, [".tsx"]),
  ...scanner.list(["lib"], [".ts"]).filter((f) => /^lib\/(commands|notifications|notify)/.test(f)),
  "public/sw.js",
];

function offenders(files: string[], pattern: RegExp, source: "copy" | "code" = "copy"): string[] {
  const found: string[] = [];
  for (const file of files) {
    const scanned = scanner.scan(file);
    const haystack = source === "copy" ? scanned.copy : [scanned.code];
    if (haystack.some((text) => pattern.test(text))) found.push(file);
  }
  return found;
}

describe("product invariants", () => {
  it("uses no emoji anywhere in source or the service worker", () => {
    // Pictographs, dingbats and symbols. Arrows and typographic marks are fine.
    const emoji = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/u;
    const files = [...scanner.list(["app", "components", "lib", "modules"], [".ts", ".tsx"]), "public/sw.js"];
    const found = files.filter((file) => emoji.test(scanner.raw(file)));
    expect(found).toEqual([]);
  });

  it("says drink, not beer, in user-facing copy", () => {
    expect(offenders(COPY_FILES, /\bbeers?\b/i)).toEqual([]);
  });

  it("keeps retired vocabulary out of copy", () => {
    // Cheers replaced kudos/proost; ratings were stripped app-wide.
    expect(offenders(COPY_FILES, /\b(proost|kudos|rating|ratings)\b/i)).toEqual([]);
  });

  it("shows no average or per-hour/per-day volume framing in the ambient UI", () => {
    // The session share card's pace is the one sanctioned exception, and it
    // renders through the share-image route, not these files.
    const files = COPY_FILES.filter((f) => !f.includes("share-image") && !f.includes("shareImage"));
    expect(offenders(files, /\b(avg|average)\b|\bper (hour|day)\b|\/(hour|day)\b/i)).toEqual([]);
  });

  it("uses the exact wrong-code message for crews", () => {
    const literals = scanner.scan("lib/commands/groupCommands.ts").copy;
    const codeMessages = literals.filter((s) => /code/i.test(s) && /(match|invalid|wrong|incorrect)/i.test(s));
    expect(codeMessages.length).toBeGreaterThan(0);
    expect([...new Set(codeMessages)]).toEqual(["That code doesn't match any crew."]);
  });

  it("never mentions a streak in the logging flow", () => {
    const files = ["components/drink/log-drink-form.tsx", ...scanner.list(["app/(app)/log"], [".tsx", ".ts"])];
    expect(offenders(files, /streak|activeWeeks/i, "code")).toEqual([]);
  });

  describe("honey is for achievements only", () => {
    // Rules in globals.css allowed to use --honey. The first group is
    // achievements. The last two predate this test and are flagged for a
    // product call rather than silently blessed: do not add to this list
    // without one.
    const ALLOWED_SELECTORS = [
      /^\.rowmark\.ach\b/,
      /^\.ach-card\b/,
      /^\.badge-chip\b/,
      /^\.callout \.mark\b/, // TODO(product): is the callout mark an achievement?
      /^\.lb \.rank\.top\b/, // TODO(product): leaderboard top rank, not strictly an achievement
    ];

    it("is only used by achievement rules in the stylesheet", () => {
      const lines = scanner.raw("app/globals.css").split("\n");
      const bad: string[] = [];
      lines.forEach((line, index) => {
        if (!/--honey\b|--color-honey\b/.test(line) || /^\s*--(color-)?honey\s*:/.test(line)) return;
        let at = index;
        while (at > 0 && !lines[at]!.includes("{")) at--;
        const selector = lines[at]!.split("{")[0]!.trim();
        if (!ALLOWED_SELECTORS.some((allowed) => allowed.test(selector))) bad.push(`${index + 1}: ${selector}`);
      });
      expect(bad).toEqual([]);
    });

    it("is not referenced from components or pages", () => {
      // session-map.tsx draws the Local Legend pin (an achievement) with
      // MAP_HONEY from lib/mapProjection.ts.
      const files = scanner
        .list(["app", "components"], [".ts", ".tsx"])
        .filter((f) => f !== "components/drink/session-map.tsx");
      expect(offenders(files, /honey/i, "code")).toEqual([]);
    });
  });

  it("scans a meaningful number of files (guards against a silently empty glob)", () => {
    expect(COPY_FILES.length).toBeGreaterThan(50);
  });
});
