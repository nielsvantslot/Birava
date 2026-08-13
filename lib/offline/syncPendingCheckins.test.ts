import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PendingCheckin } from "./pendingCheckins";

const { getAllPendingCheckins, updatePendingCheckin, removePendingCheckin } = vi.hoisted(() => ({
  getAllPendingCheckins: vi.fn(),
  updatePendingCheckin: vi.fn(),
  removePendingCheckin: vi.fn(),
}));
const { uploadMock } = vi.hoisted(() => ({ uploadMock: vi.fn() }));
const { addDrinkMock } = vi.hoisted(() => ({ addDrinkMock: vi.fn() }));

vi.mock("@/lib/offline/pendingCheckins", () => ({ getAllPendingCheckins, updatePendingCheckin, removePendingCheckin }));
vi.mock("@/modules/photo-upload/client", () => ({ PhotoUploader: { upload: uploadMock } }));
vi.mock("@/lib/controllers/drinkController", () => ({ addDrink: addDrinkMock }));
vi.mock("@/lib/achievements", () => ({ triggerConfetti: vi.fn() }));
vi.mock("@/components/ui/toast-pill", () => ({ showToast: vi.fn() }));

import { flushPendingCheckins } from "./syncPendingCheckins";

function entry(overrides: Partial<PendingCheckin> = {}): PendingCheckin {
  return {
    id: "entry-1",
    createdAt: 0,
    status: "queued",
    payload: { drinkName: "IPA", drinkType: "Beer", venue: null, lat: null, lng: null },
    photo: { kind: "none" },
    ...overrides,
  };
}

describe("flushPendingCheckins", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    updatePendingCheckin.mockResolvedValue(undefined);
    removePendingCheckin.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("marks an entry failed once its addDrink call passes the sync timeout, and still processes the next entry", async () => {
    getAllPendingCheckins.mockResolvedValue([entry({ id: "stuck" }), entry({ id: "second" })]);
    addDrinkMock
      .mockImplementationOnce(() => new Promise(() => {})) // never resolves — the exact hang PR #261 fixed
      .mockResolvedValueOnce({});

    const flush = flushPendingCheckins("user-1", true, { silent: true });
    await vi.advanceTimersByTimeAsync(45_000);
    await flush;

    expect(updatePendingCheckin).toHaveBeenCalledWith("stuck", { status: "failed", lastError: expect.any(String) });
    expect(removePendingCheckin).toHaveBeenCalledWith("second");
  });

  it("re-queues (rather than fails) an entry on an immediate network error, and still processes the rest of the pass", async () => {
    getAllPendingCheckins.mockResolvedValue([entry({ id: "offline" }), entry({ id: "next" })]);
    addDrinkMock.mockRejectedValueOnce(new Error("network error")).mockResolvedValueOnce({});

    await flushPendingCheckins("user-1", true, { silent: true });

    expect(updatePendingCheckin).toHaveBeenCalledWith("offline", { status: "queued" });
    expect(addDrinkMock).toHaveBeenCalledTimes(2);
    expect(removePendingCheckin).toHaveBeenCalledWith("next");
  });

  it("doesn't let one entry's network error abort entries further down the queue", async () => {
    getAllPendingCheckins.mockResolvedValue([
      entry({ id: "first" }),
      entry({ id: "flaky" }),
      entry({ id: "third" }),
    ]);
    addDrinkMock
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("transient network error"))
      .mockResolvedValueOnce({});

    await flushPendingCheckins("user-1", true, { silent: true });

    expect(addDrinkMock).toHaveBeenCalledTimes(3);
    expect(removePendingCheckin).toHaveBeenCalledWith("first");
    expect(updatePendingCheckin).toHaveBeenCalledWith("flaky", { status: "queued" });
    expect(removePendingCheckin).toHaveBeenCalledWith("third");
  });

  it("marks an entry failed (and continues the pass) when the server responds with an error result", async () => {
    getAllPendingCheckins.mockResolvedValue([entry({ id: "rejected" }), entry({ id: "next" })]);
    addDrinkMock.mockResolvedValueOnce({ error: "That code doesn't match any crew." }).mockResolvedValueOnce({});

    await flushPendingCheckins("user-1", true, { silent: true });

    expect(updatePendingCheckin).toHaveBeenCalledWith("rejected", {
      status: "failed",
      lastError: "That code doesn't match any crew.",
    });
    expect(removePendingCheckin).toHaveBeenCalledWith("next");
  });

  it("skips entries already marked failed without calling addDrink", async () => {
    getAllPendingCheckins.mockResolvedValue([entry({ id: "already-failed", status: "failed" })]);

    await flushPendingCheckins("user-1", true, { silent: true });

    expect(addDrinkMock).not.toHaveBeenCalled();
  });

  function rawPhoto(name: string): PendingCheckin["photo"] {
    return { kind: "raw", arrayBuffer: new ArrayBuffer(1), type: "image/jpeg", name };
  }

  it("uploads photos for every queued entry concurrently, not one at a time", async () => {
    vi.useRealTimers(); // this test cares about microtask ordering, not the sync timeout
    getAllPendingCheckins.mockResolvedValue([
      entry({ id: "a", photo: rawPhoto("a.jpg") }),
      entry({ id: "b", photo: rawPhoto("b.jpg") }),
    ]);
    let resolveFirst: (value: { url: string; lqip: null }) => void = () => {};
    const firstUpload = new Promise<{ url: string; lqip: null }>((resolve) => {
      resolveFirst = resolve;
    });
    uploadMock.mockImplementationOnce(() => firstUpload).mockResolvedValueOnce({ url: "b-url", lqip: null });
    addDrinkMock.mockResolvedValue({});

    const flush = flushPendingCheckins("user-1", true, { silent: true });
    // b's upload should get kicked off even though a's is still unresolved —
    // proving they run in parallel rather than b waiting for a to settle
    // first. Polled rather than a fixed number of `await Promise.resolve()`
    // hops, since exactly how many microtask turns precede this is an
    // implementation detail of flushPendingCheckins, not this test's concern.
    await vi.waitFor(() => expect(uploadMock).toHaveBeenCalledTimes(2));

    resolveFirst({ url: "a-url", lqip: null });
    await flush;

    expect(addDrinkMock).toHaveBeenCalledWith(expect.objectContaining({ photoUrl: "a-url" }));
    expect(addDrinkMock).toHaveBeenCalledWith(expect.objectContaining({ photoUrl: "b-url" }));
    expect(removePendingCheckin).toHaveBeenCalledWith("a");
    expect(removePendingCheckin).toHaveBeenCalledWith("b");
  });

  it("reuses an already-uploaded photo without calling PhotoUploader.upload again", async () => {
    getAllPendingCheckins.mockResolvedValue([
      entry({ id: "resumed", photo: { kind: "uploaded", url: "existing-url", lqip: "lqip-data" } }),
    ]);
    addDrinkMock.mockResolvedValue({});

    await flushPendingCheckins("user-1", true, { silent: true });

    expect(uploadMock).not.toHaveBeenCalled();
    expect(addDrinkMock).toHaveBeenCalledWith(
      expect.objectContaining({ photoUrl: "existing-url", photoLqip: "lqip-data" })
    );
    expect(removePendingCheckin).toHaveBeenCalledWith("resumed");
  });

  it("doesn't let one entry's failed photo upload block addDrink for other entries", async () => {
    getAllPendingCheckins.mockResolvedValue([
      entry({ id: "bad-photo", photo: rawPhoto("bad.jpg") }),
      entry({ id: "fine", photo: rawPhoto("fine.jpg") }),
    ]);
    uploadMock.mockResolvedValueOnce({ error: "Failed to process photo." }).mockResolvedValueOnce({ url: "fine-url", lqip: null });
    addDrinkMock.mockResolvedValue({});

    await flushPendingCheckins("user-1", true, { silent: true });

    expect(updatePendingCheckin).toHaveBeenCalledWith("bad-photo", { status: "queued" });
    expect(addDrinkMock).toHaveBeenCalledTimes(1);
    expect(addDrinkMock).toHaveBeenCalledWith(expect.objectContaining({ photoUrl: "fine-url" }));
    expect(removePendingCheckin).toHaveBeenCalledWith("fine");
  });
});
