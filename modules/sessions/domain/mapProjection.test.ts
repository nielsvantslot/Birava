import { describe, expect, it } from "vitest";
import { MAX_ZOOM, MIN_ZOOM, pickZoom, project, tileUrl } from "./mapProjection";

describe("project", () => {
  it("maps (0,0) to the center of the world at zoom 0", () => {
    expect(project({ lat: 0, lng: 0 }, 0)).toEqual({ x: 128, y: 128 });
  });

  it("maps the west and east edges of the world at zoom 0", () => {
    expect(project({ lat: 0, lng: -180 }, 0).x).toBe(0);
    expect(project({ lat: 0, lng: 180 }, 0).x).toBe(256);
  });

  it("scales the world size by 2^zoom", () => {
    const atZoom0 = project({ lat: 0, lng: 0 }, 0);
    const atZoom1 = project({ lat: 0, lng: 0 }, 1);
    expect(atZoom1.x).toBe(atZoom0.x * 2);
    expect(atZoom1.y).toBe(atZoom0.y * 2);
  });
});

describe("pickZoom", () => {
  it("returns the max usable zoom for a single point", () => {
    expect(pickZoom([{ lat: 52.37, lng: 4.89 }], 512, 250)).toBe(MAX_ZOOM - 1);
  });

  it("never returns outside the configured zoom range", () => {
    const farApart = [
      { lat: 52.0, lng: 4.0 },
      { lat: 40.0, lng: -74.0 }, // Amsterdam vs. New York
    ];
    const zoom = pickZoom(farApart, 512, 250);
    expect(zoom).toBeGreaterThanOrEqual(MIN_ZOOM);
    expect(zoom).toBeLessThanOrEqual(MAX_ZOOM);
  });

  it("picks a higher zoom for points that are closer together", () => {
    const close = [
      { lat: 52.370, lng: 4.895 },
      { lat: 52.371, lng: 4.896 },
    ];
    const far = [
      { lat: 52.0, lng: 4.0 },
      { lat: 40.0, lng: -74.0 },
    ];
    expect(pickZoom(close, 512, 250)).toBeGreaterThan(pickZoom(far, 512, 250));
  });
});

describe("tileUrl", () => {
  it("embeds zoom/x/y and picks a subdomain from a..d", () => {
    const url = tileUrl(12, 3, 5);
    expect(url).toMatch(/^https:\/\/[abcd]\.basemaps\.cartocdn\.com\/dark_all\/12\/3\/5\.png$/);
  });

  it("is deterministic for the same tile coordinates", () => {
    expect(tileUrl(10, 1, 2)).toBe(tileUrl(10, 1, 2));
  });
});
