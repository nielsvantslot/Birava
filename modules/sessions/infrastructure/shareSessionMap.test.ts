import { afterEach, describe, expect, it, vi } from "vitest";
import { renderRouteOnlyPng, renderSessionMapPng } from "./shareSessionMap";

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

function isPng(buf: Buffer): boolean {
  return buf.subarray(0, 4).equals(PNG_MAGIC);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("renderRouteOnlyPng", () => {
  it("returns null for no points", async () => {
    expect(await renderRouteOnlyPng([], 512, 250)).toBeNull();
  });

  it("renders a single point as a PNG with no network calls", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const png = await renderRouteOnlyPng([{ lat: 52.37, lng: 4.89 }], 512, 250);

    expect(png).not.toBeNull();
    expect(isPng(png!)).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("renders a multi-point route as a PNG", async () => {
    const png = await renderRouteOnlyPng(
      [
        { lat: 52.370, lng: 4.895 },
        { lat: 52.374, lng: 4.900 },
      ],
      512,
      250
    );

    expect(png).not.toBeNull();
    expect(isPng(png!)).toBe(true);
  });
});

describe("renderSessionMapPng", () => {
  it("returns null for no points without making any network calls", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    expect(await renderSessionMapPng([], 512, 250)).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns null (not a thrown error) when every tile fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false } as Response)
    );

    const png = await renderSessionMapPng([{ lat: 52.37, lng: 4.89 }], 512, 250);
    expect(png).toBeNull();
  });

  it("composites fetched tiles into a PNG", async () => {
    // A minimal 256x256 transparent tile, reused for every fetch — the point
    // is to exercise the composite/crop pipeline, not to validate real map imagery.
    const sharp = (await import("sharp")).default;
    const tileBuf = await sharp({
      create: { width: 256, height: 256, channels: 3, background: "#151A21" },
    })
      .png()
      .toBuffer();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => tileBuf.buffer.slice(tileBuf.byteOffset, tileBuf.byteOffset + tileBuf.byteLength),
      } as Response)
    );

    const png = await renderSessionMapPng(
      [
        { lat: 52.370, lng: 4.895 },
        { lat: 52.374, lng: 4.900 },
      ],
      512,
      250
    );

    expect(png).not.toBeNull();
    expect(isPng(png!)).toBe(true);
  });
});
