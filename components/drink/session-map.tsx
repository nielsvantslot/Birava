/**
 * Static route map for a session's located check-ins.
 *
 * Renders as a plain SVG (server-safe, no map library): a grid of dark
 * CARTO basemap tiles with the route drawn on top in the accent color,
 * matching the design's map treatment. Non-interactive by intent — it is
 * feed-card content, like Strava's activity maps.
 */

const W = 512;
const H = 250;
const TILE = 256;
const MIN_ZOOM = 3;
const MAX_ZOOM = 16;

export type MapPoint = { lat: number; lng: number };

export type MapPin = {
  point: MapPoint;
  /** The number rendered in the pin (venue order). */
  label: string;
  /** Local Legend venue gets the honey pin. */
  legend?: boolean;
};

function project(point: MapPoint, zoom: number): { x: number; y: number } {
  const world = TILE * 2 ** zoom;
  const rad = (point.lat * Math.PI) / 180;
  return {
    x: ((point.lng + 180) / 360) * world,
    y: ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * world,
  };
}

function pickZoom(points: MapPoint[]): number {
  if (points.length === 1) return MAX_ZOOM - 1;
  for (let zoom = MAX_ZOOM; zoom > MIN_ZOOM; zoom--) {
    const projected = points.map((p) => project(p, zoom));
    const xs = projected.map((p) => p.x);
    const ys = projected.map((p) => p.y);
    const dx = Math.max(...xs) - Math.min(...xs);
    const dy = Math.max(...ys) - Math.min(...ys);
    if (dx <= W * 0.7 && dy <= H * 0.6) return zoom;
  }
  return MIN_ZOOM;
}

export function SessionMap({
  points,
  pins,
}: {
  points: MapPoint[];
  /** Numbered venue pins (session detail); replaces the start/end dots. */
  pins?: MapPin[];
}) {
  if (points.length === 0) return null;

  const zoom = pickZoom(points);
  const projected = points.map((p) => project(p, zoom));
  const cx =
    (Math.min(...projected.map((p) => p.x)) +
      Math.max(...projected.map((p) => p.x))) /
    2;
  const cy =
    (Math.min(...projected.map((p) => p.y)) +
      Math.max(...projected.map((p) => p.y))) /
    2;
  const originX = cx - W / 2;
  const originY = cy - H / 2;

  const maxTile = 2 ** zoom - 1;
  const tiles: Array<{ x: number; y: number; left: number; top: number }> = [];
  for (
    let tx = Math.floor(originX / TILE);
    tx * TILE < originX + W;
    tx++
  ) {
    for (
      let ty = Math.max(0, Math.floor(originY / TILE));
      ty * TILE < originY + H && ty <= maxTile;
      ty++
    ) {
      tiles.push({ x: tx, y: ty, left: tx * TILE - originX, top: ty * TILE - originY });
    }
  }

  const route = projected.map((p) => ({ x: p.x - originX, y: p.y - originY }));
  const path = route
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const start = route[0];
  const end = route[route.length - 1];
  const subdomains = ["a", "b", "c", "d"];

  return (
    <svg
      className="map"
      viewBox={`0 0 ${W} ${H}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Route map of the session"
    >
      <rect width={W} height={H} fill="#151A21" />
      {tiles.map((tile) => (
        <image
          key={`${tile.x}-${tile.y}`}
          href={`https://${subdomains[(tile.x + tile.y) % 4]}.basemaps.cartocdn.com/dark_all/${zoom}/${tile.x}/${tile.y}.png`}
          x={tile.left}
          y={tile.top}
          width={TILE}
          height={TILE}
        />
      ))}
      {route.length > 1 && (
        <path
          d={path}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {!pins && (
        <>
          {route.slice(1, -1).map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="4.5"
              fill="var(--accent)"
              stroke="#151A21"
              strokeWidth="1.6"
            />
          ))}
          <circle
            cx={start.x}
            cy={start.y}
            r="6"
            fill="var(--accent)"
            stroke="#151A21"
            strokeWidth="2.5"
          />
          {route.length > 1 && (
            <circle
              cx={end.x}
              cy={end.y}
              r="6"
              fill="var(--ink)"
              stroke="#151A21"
              strokeWidth="2.5"
            />
          )}
        </>
      )}
      {pins?.map((pin) => {
        const p = project(pin.point, zoom);
        const x = p.x - originX;
        const y = p.y - originY;
        return (
          <g key={pin.label}>
            <circle
              cx={x}
              cy={y}
              r={pin.legend ? 12 : 11}
              fill={pin.legend ? "#E8C15A" : "#A9C641"}
              stroke="#151A21"
              strokeWidth="3"
            />
            <text
              x={x}
              y={y + 4}
              textAnchor="middle"
              style={{
                fontSize: 12,
                fontWeight: 800,
                fill: "#141A06",
                fontFamily: "var(--font)",
              }}
            >
              {pin.label}
            </text>
          </g>
        );
      })}
      <text
        x={W - 6}
        y={H - 6}
        textAnchor="end"
        style={{ fontSize: 9, fill: "var(--ink-dim)", opacity: 0.8 }}
      >
        © OpenStreetMap © CARTO
      </text>
    </svg>
  );
}
