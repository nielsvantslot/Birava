import path from "path";
import { defineConfig } from "vitest/config";

const alias = { "@": path.resolve(__dirname, ".") };
// tsconfig keeps jsx "preserve" for Next; Vite needs to compile JSX itself
// (share image card is JSX and is reachable from the sessions module index).
const oxc = { jsx: { runtime: "automatic" as const } };

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      // Coverage is measured over the server-side logic only; UI components
      // and route files are covered by Playwright, not by line coverage.
      include: ["lib/**/*.ts", "modules/**/*.ts"],
      exclude: ["**/*.test.ts", "lib/dtos/**", "**/*.d.ts"],
      reporter: ["text-summary", "json-summary"],
      reportsDirectory: "coverage",
      // Floors, not targets: set just below the values measured when this
      // was introduced (2026-10), so coverage can only ratchet up. Raise a
      // floor in the same PR that raises the coverage behind it. UI code
      // deliberately has none.
      thresholds: {
        // Pure domain rules — the Birava 2.0 invariants live here.
        "{modules/sessions/domain/{sessions,mapProjection},modules/achievements/domain/achievements,modules/crews/domain/crews,modules/notifications/domain/sessionReminderAlgorithm,modules/venues/domain/venueMatching,lib/dates,lib/backup/backupRetention}.ts": {
          lines: 92,
          branches: 88,
        },
        "modules/*/application/!(password).ts": { lines: 35, branches: 32 },
        "modules/*/server/*{Queries,Select,Visibility,Resolver}.ts": { lines: 55, branches: 35 },
      },
    },
    projects: [
      {
        resolve: { alias },
        oxc,
        test: {
          name: "unit",
          environment: "node",
          include: ["lib/**/*.test.ts", "modules/**/*.test.ts", "sw/**/*.test.ts"],
        },
      },
      {
        resolve: { alias },
        oxc,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          setupFiles: ["tests/integration/setup.ts"],
          // Real Postgres round trips are slower than in-memory unit tests.
          testTimeout: 15000,
          // All integration files share one physical test database that
          // gets truncated between tests — running files concurrently would
          // let one file's reset stomp on another's in-flight assertions.
          fileParallelism: false,
        },
      },
    ],
  },
});
