import { execSync } from "node:child_process";
import packageJson from "../package.json";

// Vercel bakes VERCEL_GIT_COMMIT_SHA into every build/runtime env — it changes
// on every deploy with zero manual bumping. The `git` fallback only fires in
// local dev, where .git is actually present; never at runtime in production
// (Vercel's serverless bundle doesn't ship .git).
function getCommitSha(): string {
  const vercelSha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (vercelSha) return vercelSha.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "dev";
  }
}

function getEnvironmentLabel(): string {
  if (process.env.VERCEL_ENV === "production") return "Production";
  if (process.env.VERCEL_ENV === "preview") return "Staging";
  return "Development";
}

export function getAppVersion() {
  return {
    version: packageJson.version,
    commitSha: getCommitSha(),
    environment: getEnvironmentLabel(),
  };
}
