"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Last24hRecapProps {
  totalBeers: number;
  checkins: number;
  beersPerHour: number;
  topStyle: string | null;
  topBrewery: string | null;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// Draw the recap card directly on canvas — SVGs cannot be drawn onto canvas
// on iOS Safari (drawImage is a no-op for SVG sources), so we use the 2D API.
async function buildShareImageBlob(props: Last24hRecapProps): Promise<Blob> {
  const { totalBeers, checkins, beersPerHour, topStyle, topBrewery } = props;

  const W = 1080;
  const H = 1920;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported");

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#f59e0b");
  bg.addColorStop(0.55, "#f97316");
  bg.addColorStop(1, "#dc2626");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Card background
  ctx.fillStyle = "rgba(17,24,39,0.2)";
  roundRect(ctx, 70, 220, 940, 1210, 48);
  ctx.fill();

  // Title
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff7ed";
  ctx.font = "700 56px system-ui, sans-serif";
  ctx.fillText("Birava 24h Recap 🍺", W / 2, 360);

  ctx.fillStyle = "#ffedd5";
  ctx.font = "400 30px system-ui, sans-serif";
  ctx.fillText("Last 24 hours", W / 2, 450);

  // Stats — left column
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffedd5";
  ctx.font = "400 36px system-ui, sans-serif";
  ctx.fillText("Total beers", 130, 620);
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 82px system-ui, sans-serif";
  ctx.fillText(String(totalBeers), 130, 700);

  // Stats — right column
  ctx.fillStyle = "#ffedd5";
  ctx.font = "400 36px system-ui, sans-serif";
  ctx.fillText("Check-ins", 560, 620);
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 82px system-ui, sans-serif";
  ctx.fillText(String(checkins), 560, 700);

  // Pace
  ctx.fillStyle = "#ffedd5";
  ctx.font = "400 36px system-ui, sans-serif";
  ctx.fillText("Pace (beers/hour)", 130, 860);
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 82px system-ui, sans-serif";
  ctx.fillText(beersPerHour.toFixed(2), 130, 940);

  // Top style
  ctx.fillStyle = "#ffedd5";
  ctx.font = "400 32px system-ui, sans-serif";
  ctx.fillText("Top style", 130, 1080);
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 44px system-ui, sans-serif";
  ctx.fillText(topStyle ?? "No style yet", 130, 1140);

  // Top brewery
  ctx.fillStyle = "#ffedd5";
  ctx.font = "400 32px system-ui, sans-serif";
  ctx.fillText("Top brewery", 130, 1250);
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 44px system-ui, sans-serif";
  ctx.fillText(topBrewery ?? "No brewery yet", 130, 1310);

  // Footer
  const timestamp = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffedd5";
  ctx.font = "400 30px system-ui, sans-serif";
  ctx.fillText(timestamp, W / 2, 1590);
  ctx.fillStyle = "#fff7ed";
  ctx.font = "700 38px system-ui, sans-serif";
  ctx.fillText("birava.nl", W / 2, 1680);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.92)
  );
  if (!blob) throw new Error("Failed to generate recap image");
  return blob;
}

export function Last24hRecap(props: Last24hRecapProps) {
  const [isSharing, setIsSharing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  // Pre-generated blob so handleShare never awaits before calling navigator.share().
  // iOS Safari revokes the user-gesture ("transient activation") the moment any
  // await is encountered, which causes the share sheet to silently fail on the
  // first tap when the blob is built inside the handler.
  const blobRef = useRef<Blob | null>(null);

  useEffect(() => {
    blobRef.current = null;
    buildShareImageBlob(props)
      .then((b) => { blobRef.current = b; })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.totalBeers, props.checkins, props.beersPerHour, props.topStyle, props.topBrewery]);

  const handleShare = async () => {
    if (isSharing) return;
    setIsSharing(true);
    setStatus(null);

    try {
      // Use the pre-generated blob when available so no await precedes
      // navigator.share() — required for iOS Safari user-gesture trust.
      // Fall back to building it now on platforms that don't need the sync path.
      const blob = blobRef.current ?? await buildShareImageBlob(props);
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
