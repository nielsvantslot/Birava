import { describe, expect, it } from "vitest";
import { VercelBlobStorageAdapter } from "../adapters/VercelBlobStorageAdapter";
import { PhotoUploadServiceFactory } from "./PhotoUploadServiceFactory";
import type { IImageProcessor } from "./IImageProcessor";

const service = PhotoUploadServiceFactory.create({
  storage: new VercelBlobStorageAdapter({ token: "unused" }),
  imageProcessor: {} as IImageProcessor,
  maxUploadBytes: 1,
  keyPrefix: (ownerId) => `entries-photos/${ownerId}`,
});

const BLOB = "https://abc123.private.blob.vercel-storage.com";

describe("PhotoUploadService.isIssuedUrl", () => {
  it("accepts a blob url in the owner's own namespace", () => {
    expect(service.isIssuedUrl(`${BLOB}/entries-photos/u1/x.webp`, "u1")).toBe(true);
  });

  it.each([
    ["another user's blob", `${BLOB}/entries-photos/u2/x.webp`],
    ["a foreign host (the store token must never travel there)", "https://evil.example/entries-photos/u1/x.webp"],
    ["plain http", "http://abc123.private.blob.vercel-storage.com/entries-photos/u1/x.webp"],
    ["a traversal into another namespace", `${BLOB}/entries-photos/u1/../u2/x.webp`],
    ["a nested path", `${BLOB}/entries-photos/u1/deeper/x.webp`],
    ["a relative path", "/uploads/..%2f..%2fetc%2fpasswd"],
    ["garbage", "not a url at all %%"],
  ])("rejects %s", (_label, url) => {
    expect(service.isIssuedUrl(url, "u1")).toBe(false);
  });
});
