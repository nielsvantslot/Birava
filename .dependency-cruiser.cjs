/**
 * Encodes docs/adr/0001-module-map-and-dependency-rules.md.
 * Known violations are recorded in .dependency-cruiser-known-violations.json
 * (a burn-down baseline); CI fails on anything not in it.
 */
const FRAMEWORKS = "^node_modules/(next|react|react-dom|@prisma/client|\.prisma)(/|$)";
const DOMAIN = "^modules/[^/]+/domain/";
const FEATURE_MODULE = "^modules/(?!photo-upload/)([^/]+)/";
const PRIVATE_FOLDERS = "^modules/(?!photo-upload/)[^/]+/(application|infrastructure)/";

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "Circular imports hide the real dependency direction.",
      from: {},
      to: { circular: true },
    },
    {
      name: "domain-is-framework-free",
      severity: "error",
      comment: "Domain code is pure: no Prisma, Next or React.",
      from: { path: DOMAIN },
      to: { path: FRAMEWORKS },
    },
    {
      name: "domain-stays-inside-the-domain",
      severity: "error",
      comment:
        "Domain may import only domain/contract folders, lib/types, lib/dates and lib/utils.",
      from: { path: DOMAIN },
      to: {
        path: [
          "^modules/[^/]+/(application|infrastructure)/",
          "^(app|components)/",
          "^lib/(?!types\.ts$|dates\.ts$|utils\.ts$)",
        ],
      },
    },
    {
      name: "infrastructure-not-application",
      severity: "error",
      from: { path: "^modules/[^/]+/infrastructure/" },
      to: { path: ["^modules/[^/]+/application/", "^(app|components)/"] },
    },
    {
      name: "application-not-ui",
      severity: "error",
      from: { path: "^modules/[^/]+/application/" },
      to: { path: ["^(app|components)/", "^node_modules/(react|react-dom)(/|$)"] },
    },
    {
      name: "cross-module-public-surface-only",
      severity: "error",
      comment:
        "Other modules, app/, components/ and lib/ reach a module only through its index, contract/ or domain/.",
      from: { path: FEATURE_MODULE },
      to: { path: PRIVATE_FOLDERS, pathNot: "^modules/$1/" },
    },
    {
      name: "outside-code-uses-public-surface-only",
      severity: "error",
      from: { path: "^(app|components|lib|scripts|middleware\.ts|instrumentation\.ts)" },
      to: { path: PRIVATE_FOLDERS },
    },
    {
      name: "components-never-reach-the-database-or-auth",
      severity: "error",
      comment: "Components render; data access and sessions belong to pages, actions and routes.",
      from: { path: "^components/" },
      to: { path: ["^lib/db\.ts$", "^lib/auth/", "^modules/[^/]+/infrastructure/"] },
    },
    {
      name: "lib-does-not-import-modules",
      severity: "error",
      comment: "lib/ is the platform; features depend on it, never the reverse.",
      from: { path: "^lib/" },
      to: { path: FEATURE_MODULE },
    },
    {
      name: "photo-upload-is-portable",
      severity: "error",
      from: { path: "^modules/photo-upload/" },
      to: { path: ["^(lib|app|components)/", "^modules/(?!photo-upload/)"] },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(^|/)\.next/|\.test\.tsx?$|^lib/version\.json$" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      mainFields: ["module", "main", "types", "typings"],
    },
    skipAnalysisNotInRules: true,
  },
};
