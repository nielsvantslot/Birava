import { ImageResponse } from "next/og";
import sharp from "sharp";
import { getCurrentUser } from "@/lib/auth/session";
import { getSessionCheckins } from "@/lib/controllers/drinkController";
import {
  findSessionWithCheckin,
  formatSessionDuration,
  sessionMinutes,
  sessionTitle,
} from "@/lib/sessions";
import { getUserTimeZone } from "@/lib/timezone";
import { drinkPhotoService } from "@/lib/photoUpload";
import { StreamBufferConverter } from "@/modules/photo-upload/StreamBufferConverter";

// Prisma (getCurrentUser / history) and the storage layer need Node, not edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WIDTH = 1080;
const HEIGHT = 1350;

const BG = "#0A0D09";
const INK = "#EEF2E7";
const INK_DIM = "#88907F";
const ACCENT = "#A9C641";
const LINE = "rgba(242, 238, 228, 0.12)";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  // Recompute the session from its bounded ±48h window (the same path the
  // detail page uses) instead of scanning the caller's whole history.
  // getSessionCheckins is only login-gated, so the own-only rule is enforced
  // explicitly below; the client falls back to a text share on 404.
  const sessionWindow = await getSessionCheckins({ anchorId: id });
  const session = sessionWindow ? findSessionWithCheckin(sessionWindow, id) : null;
  if (!session || session.userId !== user.id) {
    return new Response("Not found", { status: 404 });
  }

  const tz = await getUserTimeZone();
  const title = sessionTitle(session, tz);
  const drinks = session.checkins.length;
  const typeCount = session.types.length;
  const minutes = sessionMinutes(session);
  const venues = session.venues;
  const venueLine =
    venues.length === 0
      ? null
      : venues.length === 1
        ? venues[0]
        : `${venues[0]} + ${venues.length - 1} more`;

  // Hero photo: read bytes straight from storage, NOT the auth-gated
  // /api/photos route — a server-to-server fetch of that route carries no
  // session cookie and 401s (documented image-pipeline landmine). Embed as a
  // data URI so Satori can render it without any network fetch.
  let heroDataUri: string | null = null;
  const heroCheckin = session.checkins.find((c) => c.photo_url);
  if (heroCheckin?.photo_url) {
    try {
      const photo = await drinkPhotoService.read(heroCheckin.photo_url);
      if (photo) {
        const buf = await StreamBufferConverter.toBuffer(photo.stream);
        // Satori (next/og's renderer) can't decode WebP — every stored check-in
        // photo is WebP (lib/photoUpload.ts) — so re-encode to JPEG just for
        // this embed rather than switching the whole pipeline's storage format.
        const jpeg = await sharp(buf).jpeg({ quality: 85 }).toBuffer();
        heroDataUri = `data:image/jpeg;base64,${jpeg.toString("base64")}`;
      }
    } catch {
      /* no hero photo — card still renders with stats only */
    }
  }

  const stats: Array<{ value: string; label: string }> = [
    { value: String(drinks), label: drinks === 1 ? "drink" : "drinks" },
    { value: String(typeCount), label: typeCount === 1 ? "type" : "types" },
  ];
  // Duration only makes sense for a real session span — a lone check-in has none.
  if (minutes > 0) {
    stats.push({ value: formatSessionDuration(minutes), label: "duration" });
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: BG,
          color: INK,
          padding: 72,
        }}
      >
        {/* wordmark + kicker */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: ACCENT }}>
            Birava
          </div>
          <div style={{ display: "flex", fontSize: 28, color: INK_DIM }}>
            session recap
          </div>
        </div>

        {/* hero photo */}
        {heroDataUri && (
          <div
            style={{
              display: "flex",
              marginTop: 48,
              width: "100%",
              height: 560,
              borderRadius: 32,
              overflow: "hidden",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroDataUri}
              width={WIDTH - 144}
              height={560}
              style={{ objectFit: "cover", width: "100%", height: "100%" }}
              alt=""
            />
          </div>
        )}

        {/* title */}
        <div
          style={{
            display: "flex",
            marginTop: 56,
            fontSize: 64,
            fontWeight: 700,
            lineHeight: 1.1,
          }}
        >
          {title}
        </div>

        {venueLine && (
          <div style={{ display: "flex", marginTop: 20, fontSize: 34, color: INK_DIM }}>
            {venueLine}
          </div>
        )}

        {/* stats */}
        <div
          style={{
            display: "flex",
            marginTop: "auto",
            gap: 40,
            borderTop: `2px solid ${LINE}`,
            paddingTop: 48,
          }}
        >
          {stats.map((s) => (
            <div
              key={s.label}
              style={{ display: "flex", flexDirection: "column", flex: 1 }}
            >
              <div style={{ display: "flex", fontSize: 76, fontWeight: 800, color: ACCENT }}>
                {s.value}
              </div>
              <div style={{ display: "flex", marginTop: 8, fontSize: 30, color: INK_DIM }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* footer */}
        <div
          style={{
            display: "flex",
            marginTop: 48,
            justifyContent: "center",
            fontSize: 30,
            fontWeight: 700,
            color: INK,
          }}
        >
          birava.nl
        </div>
      </div>
    ),
    { width: WIDTH, height: HEIGHT }
  );
}
