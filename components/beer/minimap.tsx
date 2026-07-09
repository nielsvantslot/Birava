import type { MapPoint } from "@/components/beer/session-map";

/**
 * Abstract 60×44 route thumbnail for the route chip — the session's real
 * coordinates normalised into the box, drawn in the design's minimap
 * treatment (grid, accent path, start/end dots). Not a tile map on purpose:
 * at this size tiles are noise.
 */
export function Minimap({ points }: { points: MapPoint[] }) {
  const xs = points.map((p) => p.lng);
  const ys = points.map((p) => p.lat);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;

  const route = points.map((p) => ({
    x: 8 + ((p.lng - minX) / spanX) * 44,
    y: 36 - ((p.lat - minY) / spanY) * 28,
  }));
  const path = route
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const start = route[0];
  const end = route[route.length - 1];

  return (
    <svg
      className="minimap"
      viewBox="0 0 60 44"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="60" height="44" fill="#151A21" />
      <g stroke="#2A303A" strokeWidth="1" fill="none">
        <path d="M0 16h60M0 30h60M20 0v44M40 0v44" />
      </g>
      {route.length > 1 && (
        <path
          d={path}
          fill="none"
          stroke="#A9C641"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      <circle cx={start.x} cy={start.y} r="3" fill="#A9C641" />
      {route.length > 1 && <circle cx={end.x} cy={end.y} r="3" fill="#EEF2E7" />}
    </svg>
  );
}
