import type { Coords } from "./Models";

// nominatim.openstreetmap.org has no request timeout of its own — on a bad
// connection it can hang far longer than the location fix it's just
// prefilling a venue name for, so this bounds it independently.
const REVERSE_GEOCODE_TIMEOUT_MS = 5000;

export class GeolocationClient {
  static getPosition(options: PositionOptions): Promise<Coords> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            lat: Number(pos.coords.latitude.toFixed(6)),
            lng: Number(pos.coords.longitude.toFixed(6)),
          }),
        reject,
        options
      );
    });
  }

  static async reverseGeocode(coords: Coords): Promise<string | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REVERSE_GEOCODE_TIMEOUT_MS);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.lat}&lon=${coords.lng}&zoom=18`,
        { headers: { Accept: "application/json" }, signal: controller.signal }
      );
      if (!res.ok) return null;
      const data = await res.json();
      return (
        data.name ||
        data.address?.amenity ||
        data.address?.tourism ||
        data.address?.building ||
        data.address?.road ||
        null
      );
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}
