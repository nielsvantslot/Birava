import path from "path";
import { defineConfig } from "vitest/config";

const alias = { "@": path.resolve(__dirname, ".") };

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: ["lib/**/*.test.ts"],
        },
      },
      {
        resolve: { alias },
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
