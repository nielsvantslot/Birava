import sharp from "sharp";
import { type MapPin, type MapPoint, TILE, pickZoom, project, tileUrl } from "@/lib/mapProjection";

const BG = "#151A21";
const ACCENT = "#A9C641";
const INK = "#EEF2E7";
const HONEY = "#E8C15A";

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
    const zoom = pickZoom(points, width, height);
    const projected = points.map((p) => project(p, zoom));
    const cx =
      (Math.min(...projected.map((p) => p.x)) + Math.max(...projected.map((p) => p.x))) / 2;
    const cy =
      (Math.min(...projected.map((p) => p.y)) + Math.max(...projected.map((p) => p.y))) / 2;
    const originX = cx - width / 2;
    const originY = cy - height / 2;

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

    const baseBuffer = await sharp({
      create: { width: gridWidth, height: gridHeight, channels: 3, background: BG },
    })
      .composite(tileLayers.map((t) => ({ input: t.buf, left: t.left, top: t.top })))
      .extract({
        left: Math.round(cropLeft),
        top: Math.round(cropTop),
        width: cropWidth,
        height: cropHeight,
      })
      .png()
      .toBuffer();

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
          `<text x="${x}" y="${y + 4}" text-anchor="middle" font-size="12" font-weight="800" fill="#141A06">${pin.label}</text>`
        );
      }
    }

    const overlaySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${markup.join("")}</svg>`;

    return await sharp(baseBuffer)
      .composite([{ input: Buffer.from(overlaySvg) }])
      .png()
      .toBuffer();
  } catch {
    return null;
  }
}
