/**
 * Web Mercator tile projection math shared by the client-side route map
 * (`components/drink/session-map.tsx`) and the server-rendered session
 * share image (`lib/shareSessionMap.ts`) — both need the exact same
 * zoom/tile choice so the two renders agree.
 */

export const TILE = 256;
export const MIN_ZOOM = 3;
export const MAX_ZOOM = 16;

export type MapPoint = { lat: number; lng: number };

export type MapPin = {
  point: MapPoint;
  /** The number rendered in the pin (venue order). */
  label: string;
  /** Local Legend venue gets the honey pin. */
  legend?: boolean;
};

export function project(point: MapPoint, zoom: number): { x: number; y: number } {
  const world = TILE * 2 ** zoom;
  const rad = (point.lat * Math.PI) / 180;
  return {
    x: ((point.lng + 180) / 360) * world,
    y: ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * world,
  };
}

export function pickZoom(points: MapPoint[], width: number, height: number): number {
  if (points.length === 1) return MAX_ZOOM - 1;
  for (let zoom = MAX_ZOOM; zoom > MIN_ZOOM; zoom--) {
    const projected = points.map((p) => project(p, zoom));
    const xs = projected.map((p) => p.x);
    const ys = projected.map((p) => p.y);
    const dx = Math.max(...xs) - Math.min(...xs);
    const dy = Math.max(...ys) - Math.min(...ys);
    if (dx <= width * 0.7 && dy <= height * 0.6) return zoom;
  }
  return MIN_ZOOM;
}

export const CARTO_SUBDOMAINS = ["a", "b", "c", "d"];

export function tileUrl(zoom: number, x: number, y: number): string {
  const sub = CARTO_SUBDOMAINS[(x + y) % 4];
  return `https://${sub}.basemaps.cartocdn.com/dark_all/${zoom}/${x}/${y}.png`;
}
