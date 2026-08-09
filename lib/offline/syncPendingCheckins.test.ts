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

  it("re-queues (rather than fails) an entry on an immediate network error, and stops the pass there", async () => {
    getAllPendingCheckins.mockResolvedValue([entry({ id: "offline" }), entry({ id: "untouched" })]);
    addDrinkMock.mockRejectedValueOnce(new Error("network error"));

    await flushPendingCheckins("user-1", true, { silent: true });

    expect(updatePendingCheckin).toHaveBeenCalledWith("offline", { status: "queued" });
    expect(addDrinkMock).toHaveBeenCalledTimes(1);
    expect(removePendingCheckin).not.toHaveBeenCalled();
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
});
