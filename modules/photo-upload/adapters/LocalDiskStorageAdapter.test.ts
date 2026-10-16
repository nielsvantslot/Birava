import { mkdtemp, mkdir, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import { LocalDiskStorageAdapter } from "./LocalDiskStorageAdapter";

async function setup() {
  const base = await mkdtemp(path.join(os.tmpdir(), "birava-uploads-"));
  const rootDir = path.join(base, "uploads");
  await mkdir(path.join(rootDir, "entries-photos", "u1"), { recursive: true });
  await writeFile(path.join(rootDir, "entries-photos", "u1", "a.webp"), "image");
  await writeFile(path.join(base, "secret.txt"), "secret");
  return { adapter: new LocalDiskStorageAdapter({ rootDir, publicPathPrefix: "/uploads" }) };
}

describe("LocalDiskStorageAdapter", () => {
  it("serves a file inside its root", async () => {
    const { adapter } = await setup();
    expect(await adapter.get("/uploads/entries-photos/u1/a.webp")).not.toBeNull();
  });

  it.each([
    "/uploads/..%2fsecret.txt",
    "/uploads/..%2F..%2F..%2Fetc%2Fpasswd",
    "/uploads/entries-photos/..%2f..%2fsecret.txt",
    "/uploads/../secret.txt",
    "/uploads/%2e%2e%2fsecret.txt",
    "/elsewhere/entries-photos/u1/a.webp",
    "/uploads",
  ])("refuses %s", async (url) => {
    const { adapter } = await setup();
    expect(adapter.isOwnUrl(url)).toBe(false);
    expect(await adapter.get(url)).toBeNull();
  });
});
