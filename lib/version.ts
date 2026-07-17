// lib/version.json is regenerated at build time by scripts/write-version.ts
// from the latest git tag (see .github/workflows/tag-version.yml). It's
// committed with a "0.0.0" placeholder so this static import always resolves
// (including local dev/typecheck without running that script) and Next's
// serverless file tracing can follow it.
import versionData from "./version.json";

export function getAppVersion() {
  return { version: versionData.version };
}
