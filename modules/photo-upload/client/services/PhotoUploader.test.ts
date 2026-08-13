import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PhotoUploader } from "./PhotoUploader";
import type { DirectUploadEndpoints } from "../Models";
import type { IDirectUploadTransport } from "./IDirectUploadTransport";

function makeFile(name = "photo.jpg"): File {
  return new File([new Blob(["data"])], name, { type: "image/jpeg" });
}

/** Simulates the exact failure mode these tests exist to catch: the browser reaches this app fine, but a direct-to-storage PUT never settles. */
function neverResolvingTransport(): IDirectUploadTransport {
  return { putDirect: () => new Promise(() => {}) };
}

function immediateTransport(url: string): IDirectUploadTransport {
  return { putDirect: vi.fn().mockResolvedValue({ url }) };
}

describe("PhotoUploader.upload (direct mode)", () => {
  const baseEndpoints: Omit<DirectUploadEndpoints, "transport" | "fallbackUploadUrl"> = {
    mode: "direct",
    tokenUrl: "/token",
    finalizeUrl: "/finalize",
    keyPrefix: "prefix",
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("returns the finalized URL on a normal direct upload, without touching the fallback", async () => {
    const transport = immediateTransport("https://blob/raw.jpg");
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ url: "https://cdn/final.jpg", lqip: "abc" }),
    } as Response);

    const result = await PhotoUploader.upload(makeFile(), {
      ...baseEndpoints,
      transport,
      fallbackUploadUrl: "/fallback",
    });

    expect(result).toEqual({ url: "https://cdn/final.jpg", lqip: "abc" });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/finalize");
  });

  it("falls back to the server route once the direct upload passes the timeout, when a fallback is configured", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ url: "https://cdn/fallback.jpg", lqip: null }),
    } as Response);

    const promise = PhotoUploader.upload(makeFile(), {
      ...baseEndpoints,
      transport: neverResolvingTransport(),
      fallbackUploadUrl: "/fallback",
    });

    await vi.advanceTimersByTimeAsync(15_000);
    const result = await promise;

    expect(result).toEqual({ url: "https://cdn/fallback.jpg", lqip: null });
    expect(vi.mocked(fetch)).toHaveBeenCalledWith("/fallback", expect.objectContaining({ method: "POST" }));
  });

  // Regression guard for the gap found verifying last session's fix: this is
  // the exact hang PR #268 fixed for check-in photos, still reachable for
  // any config (like avatarUploadEndpoints before this change) that omits
  // fallbackUploadUrl. If this test ever starts failing because the upload
  // resolves, uploadDirect grew a timeout for the no-fallback branch too —
  // update the assertion, don't just delete the test.
  it("hangs indefinitely when the direct upload stalls and no fallback is configured", async () => {
    let settled = false;
    void PhotoUploader.upload(makeFile(), {
      ...baseEndpoints,
      transport: neverResolvingTransport(),
    }).then(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(60_000);
    expect(settled).toBe(false);
  });
});
