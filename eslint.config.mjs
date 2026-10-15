import { defineConfig, globalIgnores } from "eslint/config";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const eslintConfig = defineConfig([
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Configuration is read in one place (lib/env) so it is validated at
  // startup. Tooling outside these folders (scripts/, prisma/, playwright)
  // reads its own variables directly.
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.ts", "modules/**/*.ts"],
    ignores: ["lib/env/**", "**/*.test.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[object.name='process'][property.name='env']",
          message: "Read configuration through lib/env (Env.server on the server, PublicEnv in client code).",
        },
      ],
    },
  },
  // Module boundaries (docs/adr/0001-module-map-and-dependency-rules.md).
  // dependency-cruiser is the authority in CI; these give editor feedback.
  {
    files: ["modules/*/domain/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["next", "next/*", "react", "react-dom", "@prisma/client"], message: "Domain code is pure: no Next, React or Prisma." },
            { group: ["**/application/**", "**/infrastructure/**", "@/app/**", "@/components/**"], message: "Domain code cannot depend on outer layers." },
          ],
        },
      ],
    },
  },
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}", "scripts/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@/modules/*/application/**", "@/modules/*/infrastructure/**"], message: "Import a module through its index, contract/ or domain/." },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
