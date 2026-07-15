import sharp from "sharp";
import {
  type MapPin,
  type MapPoint,
  MAP_ACCENT as ACCENT,
  MAP_BG as BG,
  MAP_HONEY as HONEY,
  MAP_PIN_TEXT,
  TILE,
  pickZoom,
  project,
  tileUrl,
} from "@/lib/mapProjection";

// Not shared with session-map.tsx — that file uses var(--ink) directly (it
// renders in a browser with CSS available); this is just its hex value for
// the server-rendered end dot, which has no CSS context to resolve against.
const INK = "#EEF2E7";

type Frame = { zoom: number; originX: number; originY: number };

function frame(points: MapPoint[], width: number, height: number): Frame {
  const zoom = pickZoom(points, width, height);
  const projected = points.map((p) => project(p, zoom));
  const cx =
    (Math.min(...projected.map((p) => p.x)) + Math.max(...projected.map((p) => p.x))) / 2;
  const cy =
    (Math.min(...projected.map((p) => p.y)) + Math.max(...projected.map((p) => p.y))) / 2;
  return { zoom, originX: cx - width / 2, originY: cy - height / 2 };
}

/** Route line + start/end dots (or numbered pins), as standalone SVG markup — no basemap, no background rect. */
function routeOverlaySvg(
  points: MapPoint[],
  width: number,
  height: number,
  { zoom, originX, originY }: Frame,
  pins?: MapPin[]
): string {
  const projected = points.map((p) => project(p, zoom));
  const route = projected.map((p) => ({ x: p.x - originX, y: p.y - originY }));
  const path = route
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const start = route[0];
  const end = route[route.length - 1];

  const markup: string[] = [];
  if (route.length > 1) {
    markup.push(
      `<path d="${path}" fill="none" stroke="${ACCENT}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>`
    );
  }
  if (!pins) {
    for (const p of route.slice(1, -1)) {
      markup.push(
        `<circle cx="${p.x}" cy="${p.y}" r="4.5" fill="${ACCENT}" stroke="${BG}" stroke-width="1.6"/>`
      );
    }
    markup.push(
      `<circle cx="${start.x}" cy="${start.y}" r="6" fill="${ACCENT}" stroke="${BG}" stroke-width="2.5"/>`
    );
    if (route.length > 1) {
      markup.push(
        `<circle cx="${end.x}" cy="${end.y}" r="6" fill="${INK}" stroke="${BG}" stroke-width="2.5"/>`
      );
    }
  } else {
    for (const pin of pins) {
      const p = project(pin.point, zoom);
      const x = p.x - originX;
      const y = p.y - originY;
      markup.push(
        `<circle cx="${x}" cy="${y}" r="${pin.legend ? 12 : 11}" fill="${pin.legend ? HONEY : ACCENT}" stroke="${BG}" stroke-width="3"/>`
      );
      markup.push(
        `<text x="${x}" y="${y + 4}" text-anchor="middle" font-size="12" font-weight="800" fill="${MAP_PIN_TEXT}">${pin.label}</text>`
      );
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${markup.join("")}</svg>`;
}

async function buildMapPng(
  points: MapPoint[],
  width: number,
  height: number,
  f: Frame,
  pins?: MapPin[]
): Promise<Buffer | null> {
  const { zoom, originX, originY } = f;

  const maxTile = 2 ** zoom - 1;
  const txMin = Math.floor(originX / TILE);
  const tyMin = Math.max(0, Math.floor(originY / TILE));
  const tiles: Array<{ x: number; y: number }> = [];
  for (let tx = txMin; tx * TILE < originX + width; tx++) {
    for (let ty = tyMin; ty * TILE < originY + height && ty <= maxTile; ty++) {
      tiles.push({ x: tx, y: ty });
    }
  }
  if (tiles.length === 0) return null;

  const txMax = Math.max(...tiles.map((t) => t.x));
  const tyMax = Math.max(...tiles.map((t) => t.y));
  const gridWidth = (txMax - txMin + 1) * TILE;
  const gridHeight = (tyMax - tyMin + 1) * TILE;

  const fetched = await Promise.all(
    tiles.map(async (tile) => {
      try {
        const res = await fetch(tileUrl(zoom, tile.x, tile.y));
        if (!res.ok) return null;
        return {
          buf: Buffer.from(await res.arrayBuffer()),
          left: (tile.x - txMin) * TILE,
          top: (tile.y - tyMin) * TILE,
        };
      } catch {
        return null;
      }
    })
  );
  const tileLayers = fetched.filter((t): t is NonNullable<typeof t> => !!t);
  if (tileLayers.length === 0) return null;

  const cropLeft = Math.min(
    Math.max(0, originX - txMin * TILE),
    Math.max(0, gridWidth - width)
  );
  const cropTop = Math.min(
    Math.max(0, originY - tyMin * TILE),
    Math.max(0, gridHeight - height)
  );
  const cropWidth = Math.min(width, gridWidth);
  const cropHeight = Math.min(height, gridHeight);

  // Composited and cropped in two separate sharp() calls, not chained on one
  // instance — sharp throws "Image to composite must have same dimensions or
  // smaller" when .composite() and .extract() are chained together on a
  // single pipeline (reproducible even with tiles that fit entirely within
  // the canvas), so the crop runs on the composite's own already-materialized
  // output instead.
  const compositeBuffer = await sharp({
    create: { width: gridWidth, height: gridHeight, channels: 3, background: BG },
  })
    .composite(tileLayers.map((t) => ({ input: t.buf, left: t.left, top: t.top })))
    .png()
    .toBuffer();

  const baseBuffer = await sharp(compositeBuffer)
    .extract({
      left: Math.round(cropLeft),
      top: Math.round(cropTop),
      width: cropWidth,
      height: cropHeight,
    })
    .png()
    .toBuffer();

  // The overlay must be built at the ACTUAL cropped size (cropWidth/Height
  // can be smaller than the requested width/height near map edges, e.g. tiles
  // clamped at the top of the world) and positioned relative to the actual
  // crop origin in world space — not the nominal width/height/originX/originY
  // — otherwise sharp rejects an oversized overlay and/or the route renders
  // offset from where it was cropped.
  const actualOrigin: Frame = {
    zoom,
    originX: txMin * TILE + cropLeft,
    originY: tyMin * TILE + cropTop,
  };
  const overlaySvg = routeOverlaySvg(points, cropWidth, cropHeight, actualOrigin, pins);

  return await sharp(baseBuffer)
    .composite([{ input: Buffer.from(overlaySvg) }])
    .png()
    .toBuffer();
}

async function buildRouteOnlyPng(
  points: MapPoint[],
  width: number,
  height: number,
  f: Frame,
  pins?: MapPin[]
): Promise<Buffer | null> {
  const svg = routeOverlaySvg(points, width, height, f, pins);
  return await sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Rasterizes the same route map `session-map.tsx` renders as SVG, but as a
 * flat PNG — next/og's ImageResponse (Satori) can embed a plain `<img>` but
 * can't render arbitrary nested SVG paths/circles, so the map is composited
 * here with sharp (tile fetch + crop + a rasterized route/pin overlay) and
 * handed to the share-image route as a data URI.
 */
export async function renderSessionMapPng(
  points: MapPoint[],
  width: number,
  height: number,
  pins?: MapPin[]
): Promise<Buffer | null> {
  if (points.length === 0) return null;
  try {
    return await buildMapPng(points, width, height, frame(points, width, height), pins);
  } catch {
    return null;
  }
}

/**
 * Route line only (no basemap tiles, no background) — for the transparent
 * "sticker" share variant, which composites onto whatever the user shares it
 * onto, so a generic basemap would look out of place. Also has no external
 * tile fetch, so it's much faster than renderSessionMapPng.
 */
export async function renderRouteOnlyPng(
  points: MapPoint[],
  width: number,
  height: number,
  pins?: MapPin[]
): Promise<Buffer | null> {
  if (points.length === 0) return null;
  try {
    return await buildRouteOnlyPng(points, width, height, frame(points, width, height), pins);
  } catch {
    return null;
  }
}

/**
 * Both share-image variants at once, computing the shared zoom/origin frame
 * only once — used by the share-image route, which always needs both.
 */
export async function renderSessionVisuals(
  points: MapPoint[],
  width: number,
  height: number,
  pins?: MapPin[]
): Promise<{ mapPng: Buffer | null; routeOnlyPng: Buffer | null }> {
  if (points.length === 0) return { mapPng: null, routeOnlyPng: null };

  const f = frame(points, width, height);
  const [mapPng, routeOnlyPng] = await Promise.all([
    buildMapPng(points, width, height, f, pins).catch(() => null),
    buildRouteOnlyPng(points, width, height, f, pins).catch(() => null),
  ]);
  return { mapPng, routeOnlyPng };
}
