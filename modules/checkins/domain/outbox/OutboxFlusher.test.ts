import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CheckinSendRequest, CheckinSendResult, ICheckinSender } from "./ICheckinSender";
import type { IOutboxNotifier } from "./IOutboxNotifier";
import type { IOutboxPhotoUploader, OutboxPhotoUpload } from "./IOutboxPhotoUploader";
import type { IOutboxStorage } from "./IOutboxStorage";
import { OutboxFlusher } from "./OutboxFlusher";
import type { PendingCheckin } from "./PendingCheckin";

// These run against plain in-memory implementations of the four ports: no
// browser, no mocks of modules. That is the point of the extraction.

class MemoryOutbox implements IOutboxStorage {
  readonly rows = new Map<string, PendingCheckin>();
  async getAll(userId: string) {
    return [...this.rows.values()].filter((e) => e.userId === userId).sort((a, b) => a.createdAt - b.createdAt);
  }
  async add(entry: Omit<PendingCheckin, "status"> & { status?: PendingCheckin["status"] }) {
    this.rows.set(entry.id, { status: "queued", ...entry });
  }
  async update(id: string, patch: Partial<Pick<PendingCheckin, "status" | "lastError" | "photo">>) {
    const row = this.rows.get(id);
    if (row) this.rows.set(id, { ...row, ...patch });
  }
  async remove(id: string) {
    this.rows.delete(id);
  }
}

const entry = (overrides: Partial<PendingCheckin> = {}): PendingCheckin => ({
  id: "e1",
  userId: "u1",
  createdAt: 1,
  status: "queued",
  payload: { drinkName: "IPA", drinkType: "Beer", venue: null, lat: null, lng: null },
  photo: { kind: "none" },
  ...overrides,
});

const raw = { kind: "raw" as const, arrayBuffer: new ArrayBuffer(4), type: "image/jpeg", name: "p.jpg" };

function setup(options: { send?: (r: CheckinSendRequest) => Promise<CheckinSendResult>; upload?: () => Promise<OutboxPhotoUpload>; timeoutMs?: number } = {}) {
  const storage = new MemoryOutbox();
  const sent: CheckinSendRequest[] = [];
  const events: string[] = [];
  const sender: ICheckinSender = {
    send: async (request) => {
      sent.push(request);
      return options.send ? options.send(request) : { ok: true, achievementUnlocked: false };
    },
  };
  const photos: IOutboxPhotoUploader = { uploadRaw: options.upload ?? (async () => ({ url: "https://cdn/p.webp", lqip: "lq" })) };
  const notifier: IOutboxNotifier = { synced: () => events.push("synced"), achievementUnlocked: () => events.push("confetti") };
  return { storage, sent, events, flusher: new OutboxFlusher(storage, photos, sender, notifier, options.timeoutMs) };
}

describe("OutboxFlusher", () => {
  beforeEach(() => void vi.useFakeTimers());
  afterEach(() => void vi.useRealTimers());

  it("sends a queued check-in with its own id as the idempotency key, removes it, and says so", async () => {
    const { storage, sent, events, flusher } = setup();
    await storage.add(entry({ id: "abc", createdAt: 7 }));

    await flusher.flush("u1");

    expect(sent).toEqual([expect.objectContaining({ clientId: "abc", createdAt: 7, drinkName: "IPA", photoUrl: null })]);
    expect(storage.rows.size).toBe(0);
    expect(events).toEqual(["synced"]);
  });

  it("stays quiet when silent, and celebrates an unlocked achievement", async () => {
    const { storage, events, flusher } = setup({ send: async () => ({ ok: true, achievementUnlocked: true }) });
    await storage.add(entry());

    await flusher.flush("u1", { silent: true });

    expect(events).toEqual(["confetti"]);
  });

  it("only sends the caller's own entries: the queue is shared by whoever uses the device", async () => {
    const { storage, sent, flusher } = setup();
    await storage.add(entry({ id: "mine", userId: "u1" }));
    await storage.add(entry({ id: "theirs", userId: "u2" }));

    await flusher.flush("u1");

    expect(sent.map((s) => s.clientId)).toEqual(["mine"]);
    expect(storage.rows.has("theirs")).toBe(true);
  });

  it("sends in the order logged, and skips entries already failed", async () => {
    const { storage, sent, flusher } = setup();
    await storage.add(entry({ id: "late", createdAt: 3 }));
    await storage.add(entry({ id: "early", createdAt: 1 }));
    await storage.add(entry({ id: "dead", createdAt: 2, status: "failed" }));

    await flusher.flush("u1");

    expect(sent.map((s) => s.clientId)).toEqual(["early", "late"]);
    expect(storage.rows.get("dead")?.status).toBe("failed");
  });

  it("fails an entry on a definitive no but keeps one queued on a transient refusal, and carries on with the rest", async () => {
    const { storage, sent, flusher } = setup({
      send: async (r) =>
        r.clientId === "no" ? { ok: false, error: "Not allowed", transient: false } : r.clientId === "later" ? { ok: false, error: "Slow down", transient: true } : { ok: true, achievementUnlocked: false },
    });
    await storage.add(entry({ id: "no", createdAt: 1 }));
    await storage.add(entry({ id: "later", createdAt: 2 }));
    await storage.add(entry({ id: "fine", createdAt: 3 }));

    await flusher.flush("u1");

    expect(storage.rows.get("no")).toMatchObject({ status: "failed", lastError: "Not allowed" });
    expect(storage.rows.get("later")).toMatchObject({ status: "queued", lastError: "Slow down" });
    expect(storage.rows.has("fine")).toBe(false);
    expect(sent).toHaveLength(3);
  });

  it("requeues an entry when the send throws (no connection) and still tries the next one", async () => {
    let calls = 0;
    const { storage, flusher } = setup({
      send: async () => {
        if (++calls === 1) throw new Error("network");
        return { ok: true, achievementUnlocked: false };
      },
    });
    await storage.add(entry({ id: "a", createdAt: 1 }));
    await storage.add(entry({ id: "b", createdAt: 2 }));

    await flusher.flush("u1");

    expect(storage.rows.get("a")?.status).toBe("queued");
    expect(storage.rows.has("b")).toBe(false);
  });

  it("marks an entry failed, instead of stuck syncing, when the send hangs past the timeout", async () => {
    const { storage, flusher } = setup({ send: () => new Promise(() => {}), timeoutMs: 1000 });
    await storage.add(entry());

    const done = flusher.flush("u1");
    await vi.advanceTimersByTimeAsync(1001);
    await done;

    expect(storage.rows.get("e1")).toMatchObject({ status: "failed", lastError: expect.stringContaining("timed out") });
  });

  it("uploads a raw photo, records the upload in the queue before sending, and sends its URL", async () => {
    const { storage, sent, flusher } = setup({
      send: async () => {
        // The upload must already be persisted by the time the send runs, so a failed send can't orphan it.
        expect(storage.rows.get("e1")?.photo).toEqual({ kind: "uploaded", url: "https://cdn/p.webp", lqip: "lq" });
        return { ok: false, error: "boom", transient: true };
      },
    });
    await storage.add(entry({ photo: raw }));

    await flusher.flush("u1");

    expect(sent[0]).toMatchObject({ photoUrl: "https://cdn/p.webp", photoLqip: "lq" });
    expect(storage.rows.get("e1")?.photo.kind).toBe("uploaded");
  });

  it("reuses an already uploaded photo without uploading again", async () => {
    const upload = vi.fn(async () => ({ url: "x", lqip: null }));
    const { storage, sent, flusher } = setup({ upload });
    await storage.add(entry({ photo: { kind: "uploaded", url: "https://cdn/done.webp", lqip: null } }));

    await flusher.flush("u1");

    expect(upload).not.toHaveBeenCalled();
    expect(sent[0]?.photoUrl).toBe("https://cdn/done.webp");
  });

  it("fails an entry whose photo was definitively rejected, requeues one whose upload may work later, and never sends either", async () => {
    const outcomes: OutboxPhotoUpload[] = [{ error: "Unsupported format", retryable: false }, { error: "Offline", retryable: true }];
    const { storage, sent, flusher } = setup({ upload: async () => outcomes.shift()! });
    await storage.add(entry({ id: "bad", createdAt: 1, photo: raw }));
    await storage.add(entry({ id: "maybe", createdAt: 2, photo: raw }));

    await flusher.flush("u1");

    expect(storage.rows.get("bad")).toMatchObject({ status: "failed", lastError: "Unsupported format" });
    expect(storage.rows.get("maybe")?.status).toBe("queued");
    expect(sent).toHaveLength(0);
  });

  it("uploads photos for every entry at once, not one after another", async () => {
    const starts: string[] = [];
    const { storage, flusher } = setup({
      upload: () => {
        starts.push("start");
        return new Promise(() => {});
      },
      timeoutMs: 1000,
    });
    await storage.add(entry({ id: "a", createdAt: 1, photo: raw }));
    await storage.add(entry({ id: "b", createdAt: 2, photo: raw }));

    const done = flusher.flush("u1");
    await vi.advanceTimersByTimeAsync(0);
    expect(starts).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1001);
    await done;
  });

  it("coalesces an overlapping flush into one more pass, so something queued mid-flight is not stranded", async () => {
    let release: (() => void) | undefined;
    const { storage, sent, flusher } = setup({
      send: (r) =>
        r.clientId === "first"
          ? new Promise((resolve) => {
              release = () => resolve({ ok: true, achievementUnlocked: false });
            })
          : Promise.resolve({ ok: true, achievementUnlocked: false }),
    });
    await storage.add(entry({ id: "first", createdAt: 1 }));

    const running = flusher.flush("u1");
    await vi.advanceTimersByTimeAsync(0);
    await storage.add(entry({ id: "second", createdAt: 2 }));
    await flusher.flush("u1"); // arrives mid-flight: returns at once, but asks for another pass
    release?.();
    await running;

    expect(sent.map((s) => s.clientId)).toEqual(["first", "second"]);
    expect(storage.rows.size).toBe(0);
  });
});

describe("the outbox domain has no platform dependency", () => {
  it("mentions no browser or framework API, so a React Native client can run it as is", () => {
    const forbidden = /\b(window|document|navigator|indexedDB|localStorage|IDBDatabase|new File\(|new Blob\(|fetch\()|from "(react|next)/;
    for (const file of readdirSync(__dirname).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))) {
      const source = readFileSync(join(__dirname, file), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      expect(source, file).not.toMatch(forbidden);
    }
  });
});
