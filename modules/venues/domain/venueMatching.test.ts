import { describe, expect, it } from "vitest";
import { venuesMatch } from "./venueMatching";

describe("venuesMatch", () => {
  it("matches identical name and coordinates", () => {
    expect(
      venuesMatch(
        { name: "Café Gollem", lat: 52.3648, lng: 4.889 },
        { name: "Café Gollem", lat: 52.3648, lng: 4.889 }
      )
    ).toBe(true);
  });

  it("matches names differing only by case and surrounding whitespace", () => {
    expect(
      venuesMatch(
        { name: "  Café Gollem ", lat: 52.3648, lng: 4.889 },
        { name: "café gollem", lat: 52.3648, lng: 4.889 }
      )
    ).toBe(true);
  });

  it("does not match different names at the same coordinates", () => {
    expect(
      venuesMatch(
        { name: "Café Gollem", lat: 52.3648, lng: 4.889 },
        { name: "Café Thijssen", lat: 52.3648, lng: 4.889 }
      )
    ).toBe(false);
  });

  it("matches the same name within the proximity threshold", () => {
    expect(
      venuesMatch(
        { name: "Café Gollem", lat: 52.3648, lng: 4.889 },
        { name: "Café Gollem", lat: 52.36485, lng: 4.8891 } // a few meters off
      )
    ).toBe(true);
  });

  it("does not match the same name far outside the proximity threshold", () => {
    expect(
      venuesMatch(
        { name: "Café Gollem", lat: 52.3648, lng: 4.889 },
        { name: "Café Gollem", lat: 52.38, lng: 4.91 } // a different neighbourhood
      )
    ).toBe(false);
  });

  it("falls back to name-only matching when either side lacks coordinates", () => {
    expect(venuesMatch({ name: "Café Gollem", lat: null, lng: null }, { name: "Café Gollem", lat: 52.3648, lng: 4.889 })).toBe(
      true
    );
    expect(venuesMatch({ name: "Café Gollem", lat: 52.3648, lng: 4.889 }, { name: "Café Gollem", lat: null, lng: null })).toBe(
      true
    );
    expect(venuesMatch({ name: "Café Gollem", lat: null, lng: null }, { name: "Café Gollem", lat: null, lng: null })).toBe(
      true
    );
  });

  it("matches two nameless entries purely by proximity", () => {
    expect(venuesMatch({ name: null, lat: 52.3648, lng: 4.889 }, { name: null, lat: 52.36485, lng: 4.8891 })).toBe(true);
  });

  it("does not match two nameless entries outside the proximity threshold", () => {
    expect(venuesMatch({ name: null, lat: 52.3648, lng: 4.889 }, { name: null, lat: 52.38, lng: 4.91 })).toBe(false);
  });

  it("matches a nameless entry against a named venue at the same coordinates (claims it, doesn't reject for the name mismatch)", () => {
    expect(venuesMatch({ name: null, lat: 52.3648, lng: 4.889 }, { name: "Café Gollem", lat: 52.3648, lng: 4.889 })).toBe(
      true
    );
  });

  it("does not match a named-but-coordinate-less entry against a nameless (coordinate-only) venue", () => {
    // Nothing shared to compare: no name on one side, no coordinates on the other.
    expect(venuesMatch({ name: "Café Gollem", lat: null, lng: null }, { name: null, lat: 52.3648, lng: 4.889 })).toBe(
      false
    );
  });
});
