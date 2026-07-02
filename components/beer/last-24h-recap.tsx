"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Last24hRecapProps {
  totalBeers: number;
  checkins: number;
  beersPerHour: number;
  topStyle: string | null;
  topBrewery: string | null;
}

function escapeSvgText(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildStorySvg({
  totalBeers,
  checkins,
  beersPerHour,
  topStyle,
  topBrewery,
}: Last24hRecapProps) {
  const pace = beersPerHour.toFixed(2);
  const style = topStyle ?? "No style yet";
  const brewery = topBrewery ?? "No brewery yet";
  const timestamp = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f59e0b" />
      <stop offset="55%" stop-color="#f97316" />
      <stop offset="100%" stop-color="#dc2626" />
    </linearGradient>
  </defs>
  <rect width="1080" height="1920" fill="url(#bg)" />
  <rect x="70" y="220" width="940" height="1210" rx="48" fill="rgba(17,24,39,0.2)" />
  <text x="540" y="360" text-anchor="middle" fill="#fff7ed" font-size="56" font-weight="700" font-family="Inter, system-ui, sans-serif">Birava 24h Recap 🍺</text>
  <text x="540" y="450" text-anchor="middle" fill="#ffedd5" font-size="30" font-family="Inter, system-ui, sans-serif">Last 24 hours</text>

  <text x="130" y="620" fill="#ffedd5" font-size="36" font-family="Inter, system-ui, sans-serif">Total beers</text>
  <text x="130" y="700" fill="#fff" font-size="82" font-weight="800" font-family="Inter, system-ui, sans-serif">${escapeSvgText(String(totalBeers))}</text>

  <text x="560" y="620" fill="#ffedd5" font-size="36" font-family="Inter, system-ui, sans-serif">Check-ins</text>
  <text x="560" y="700" fill="#fff" font-size="82" font-weight="800" font-family="Inter, system-ui, sans-serif">${escapeSvgText(String(checkins))}</text>

  <text x="130" y="860" fill="#ffedd5" font-size="36" font-family="Inter, system-ui, sans-serif">Pace (beers/hour)</text>
  <text x="130" y="940" fill="#fff" font-size="82" font-weight="800" font-family="Inter, system-ui, sans-serif">${escapeSvgText(pace)}</text>

  <text x="130" y="1080" fill="#ffedd5" font-size="32" font-family="Inter, system-ui, sans-serif">Top style</text>
  <text x="130" y="1140" fill="#fff" font-size="44" font-weight="600" font-family="Inter, system-ui, sans-serif">${escapeSvgText(style)}</text>

  <text x="130" y="1250" fill="#ffedd5" font-size="32" font-family="Inter, system-ui, sans-serif">Top brewery</text>
  <text x="130" y="1310" fill="#fff" font-size="44" font-weight="600" font-family="Inter, system-ui, sans-serif">${escapeSvgText(brewery)}</text>

  <text x="540" y="1590" text-anchor="middle" fill="#ffedd5" font-size="30" font-family="Inter, system-ui, sans-serif">${escapeSvgText(timestamp)}</text>
  <text x="540" y="1680" text-anchor="middle" fill="#fff7ed" font-size="38" font-weight="700" font-family="Inter, system-ui, sans-serif">birava.nl</text>
</svg>
`.trim();
}

async function svgToShareImageBlob(svg: string) {
  // Use a data URL instead of a blob URL — iOS Safari fails to render SVG
  // blob URLs onto canvas, resulting in a blank image.
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load recap image"));
    img.src = url;
  });

  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not supported");
  context.fillStyle = "#f97316";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0);

  const shareBlob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.92)
  );

  if (!shareBlob) throw new Error("Failed to generate recap image");
  return shareBlob;
}

export function Last24hRecap(props: Last24hRecapProps) {
  const [isSharing, setIsSharing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const storySvg = useMemo(() => buildStorySvg(props), [props]);

  const handleShare = async () => {
    setIsSharing(true);
    setStatus(null);

    try {
      const blob = await svgToShareImageBlob(storySvg);
      const filename = `birava-24h-recap-${new Date().toISOString().slice(0, 10)}.jpg`;
      const file = new File([blob], filename, { type: "image/jpeg" });

      if (
        navigator.canShare &&
        navigator.share &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          files: [file],
          title: "My Birava 24h recap",
          text: "My Birava stats from the last 24 hours 🍺",
        });
        setStatus("Shared!");
        return;
      }

      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(downloadUrl);
      setStatus("Image downloaded.");
    } catch {
      setStatus("Could not generate recap image.");
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Card className="overflow-hidden border-[var(--primary)]/30 bg-gradient-to-br from-amber-500 via-orange-500 to-red-600 text-white">
      <CardContent className="p-5 space-y-4">
        <div>
          <h2 className="text-lg font-black">24h Recap Story 🔥</h2>
          <p className="text-sm text-white/85">
            Share your last 24 hours in one tap.
          </p>
        </div>

        <div className="rounded-xl bg-black/20 p-4 grid grid-cols-2 gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-white/70">Total beers</p>
            <p className="text-2xl font-black">{props.totalBeers}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-white/70">Check-ins</p>
            <p className="text-2xl font-black">{props.checkins}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-white/70">Beers/hour</p>
            <p className="text-2xl font-black">{props.beersPerHour.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-white/70">Top style</p>
            <p className="text-base font-bold truncate">{props.topStyle ?? "—"}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleShare}
            variant="secondary"
            className="bg-white text-orange-700 hover:bg-amber-50"
            disabled={isSharing}
          >
            {isSharing ? "Preparing image..." : "Share 24h recap"}
          </Button>
          {status && <span className="text-xs text-white/90">{status}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
