import { describe, expect, it } from "vitest";
import { CacheNames } from "./CacheNames";
import { RequestClassifier } from "./RequestClassifier";

const url = (path: string) => new URL(`https://birava.nl${path}`);
const headers = (init: Record<string, string> = {}) => new Headers(init);

describe("RequestClassifier", () => {
  it("recognises a client-side RSC transition by its header or its _rsc param, but not a plain navigation", () => {
    expect(RequestClassifier.isRscRequest(headers({ RSC: "1" }), url("/dashboard"))).toBe(true);
    expect(RequestClassifier.isRscRequest(headers(), url("/dashboard?_rsc=abc12"))).toBe(true);
    expect(RequestClassifier.isRscRequest(headers(), url("/dashboard"))).toBe(false);
  });

  it("keys a page by its URL without the _rsc hash, so one destination shares one cache entry", () => {
    expect(RequestClassifier.pageCacheKey("https://birava.nl/stats?_rsc=1x2y")).toBe("https://birava.nl/stats");
    expect(RequestClassifier.pageCacheKey(url("/stats?tab=you&_rsc=zzz"))).toBe("https://birava.nl/stats?tab=you");
    expect(RequestClassifier.pageCacheKey("https://birava.nl/stats?_rsc=a")).toBe(RequestClassifier.pageCacheKey("https://birava.nl/stats?_rsc=b"));
  });

  it("treats only built assets, icons and the manifest as static", () => {
    expect(RequestClassifier.isStaticAsset(url("/_next/static/chunks/a.js"))).toBe(true);
    expect(RequestClassifier.isStaticAsset(url("/icons/icon-192x192.png"))).toBe(true);
    expect(RequestClassifier.isStaticAsset(url("/manifest.webmanifest"))).toBe(true);
    expect(RequestClassifier.isStaticAsset(url("/dashboard"))).toBe(false);
    expect(RequestClassifier.isStaticAsset(url("/api/photos/1"))).toBe(false);
  });

  it("serves only avatars and check-in photos from the media cache", () => {
    expect(RequestClassifier.isMediaAsset(url("/api/avatars/u1"))).toBe(true);
    expect(RequestClassifier.isMediaAsset(url("/api/photos/e1?size=thumb"))).toBe(true);
    expect(RequestClassifier.isMediaAsset(url("/api/feed"))).toBe(false);
    expect(RequestClassifier.isMediaAsset(url("/api/sessions/s1/share-image"))).toBe(false);
  });

  it("never caches an API call or another origin as page content", () => {
    expect(RequestClassifier.isPageContent(url("/dashboard"), "https://birava.nl")).toBe(true);
    expect(RequestClassifier.isPageContent(url("/api/feed"), "https://birava.nl")).toBe(false);
    expect(RequestClassifier.isPageContent(url("/_next/static/x.js"), "https://birava.nl")).toBe(false);
    expect(RequestClassifier.isPageContent(url("/dashboard"), "https://evil.example")).toBe(false);
  });
});

describe("CacheNames", () => {
  it("lists every cache the worker owns as current, so activation deletes only stale ones", () => {
    expect(CacheNames.CURRENT).toEqual([CacheNames.STATIC, CacheNames.NAV, CacheNames.RSC, CacheNames.MEDIA]);
    expect(new Set(CacheNames.CURRENT).size).toBe(4);
    for (const name of CacheNames.CURRENT) expect(name).toContain(CacheNames.VERSION);
  });

  it("precaches the offline page", () => {
    expect(CacheNames.STATIC_ASSETS).toContain(CacheNames.OFFLINE_URL);
  });
});
