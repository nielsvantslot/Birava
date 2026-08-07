/**
 * Demo seed — populates a fresh database with the "Demobeer" showcase
 * account and enough realistic data to exercise every screen (a
 * multi-venue evening session with photos + route, a lone check-in,
 * variety across drink types, a Local Legend venue, an active-weeks
 * streak, a crew with a since-joined leaderboard, and followed users).
 *
 * Runs automatically on Vercel staging/preview deploys (VERCEL_ENV=preview)
 * or when SEED_DEMO=true. It never runs on production and is a no-op on a
 * normal local dev DB unless SEED_DEMO=true is set. Idempotent: it skips
 * if the demo account already has data, and it refuses to touch an email
 * that already belongs to a non-demo account.
 *
 * Photos go through the storage abstraction, so they land in Vercel Blob
 * on staging and on local disk in development — the same pipeline the app
 * serves them from (`/api/photos/[entryId]`).
 */
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import { readFile } from "fs/promises";
import path from "path";
import { hashPassword } from "../lib/auth/password";
import { drinkPhotoService } from "../lib/photoUpload";
import { groupIntoSessions } from "../lib/sessions";
import { resolveVenueId } from "../lib/commands/venueCommands";
import type { DrinkEntry as DrinkEntryDTO, DrinkType } from "../lib/types";

const db = new PrismaClient();

const DEMO = {
  username: "Demobeer",
  email: "jairo12.jn@gmail.com",
  password: "Test123!",
};

// Amsterdam venue coordinates — only the hero session uses them, so the
// route map has real points to draw.
const V = {
  taphouse: { name: "The Local Taphouse", lat: 52.3547, lng: 4.8918 },
  ij: { name: "Brouwerij 't IJ", lat: 52.3667, lng: 4.927 },
  gollem: { name: "Café Gollem", lat: 52.3648, lng: 4.889 },
};

const now = new Date();
function at(daysAgo: number, hour: number, minute: number): Date {
  const d = new Date(now);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d;
}

type Seeded = {
  daysAgo: number;
  hour: number;
  minute: number;
  drinkType: DrinkType;
  beerName: string;
  venue: string;
  lat?: number;
  lng?: number;
  /** Which committed image to attach, if any. */
  photo?: "grass" | "pint" | "party";
};

// Demobeer's own history. The first cluster (daysAgo 1) is one evening
// session — three venues, five check-ins, three photos, a route.
const DEMO_CHECKINS: Seeded[] = [
  { daysAgo: 1, hour: 18, minute: 27, drinkType: "Beer", beerName: "Zwart Water", venue: V.taphouse.name, lat: V.taphouse.lat, lng: V.taphouse.lng, photo: "grass" },
  { daysAgo: 1, hour: 18, minute: 52, drinkType: "Beer", beerName: "Taphouse Pils", venue: V.taphouse.name, lat: V.taphouse.lat, lng: V.taphouse.lng },
  { daysAgo: 1, hour: 20, minute: 10, drinkType: "Beer", beerName: "IJwit", venue: V.ij.name, lat: V.ij.lat, lng: V.ij.lng, photo: "pint" },
  { daysAgo: 1, hour: 20, minute: 48, drinkType: "Cocktail", beerName: "Negroni", venue: V.ij.name, lat: V.ij.lat, lng: V.ij.lng },
  { daysAgo: 1, hour: 21, minute: 40, drinkType: "Beer", beerName: "Struise Pannepot", venue: V.gollem.name, lat: V.gollem.lat, lng: V.gollem.lng, photo: "party" },

  // Today — a lone check-in (renders as the slim card)
  { daysAgo: 0, hour: 13, minute: 5, drinkType: "Wine", beerName: "Barolo 2018", venue: "Da Vinci", photo: "grass" },

  // A single-venue session a few days back (feeds the Local Legend crown)
  { daysAgo: 5, hour: 19, minute: 0, drinkType: "Beer", beerName: "Cascade Fog", venue: V.taphouse.name },
  { daysAgo: 5, hour: 19, minute: 45, drinkType: "Beer", beerName: "Sunburst", venue: V.taphouse.name },

  // Earlier weeks — spread out with gaps so the streak shows rest weeks,
  // and enough venues/types for the discovery badges
  { daysAgo: 9, hour: 20, minute: 0, drinkType: "Beer", beerName: "Mannenliefde", venue: "Oedipus Taproom" },
  { daysAgo: 13, hour: 18, minute: 30, drinkType: "Cocktail", beerName: "Old Fashioned", venue: "Bar Oldenhof" },
  { daysAgo: 13, hour: 19, minute: 15, drinkType: "Beer", beerName: "La Chouffe", venue: "Bar Oldenhof" },
  { daysAgo: 19, hour: 17, minute: 0, drinkType: "Other", beerName: "Jopen Cider", venue: "Jopenkerk" },
  { daysAgo: 27, hour: 20, minute: 0, drinkType: "Beer", beerName: "Weizen Wolke", venue: V.taphouse.name },
  { daysAgo: 34, hour: 19, minute: 0, drinkType: "Wine", beerName: "Chianti Classico", venue: "Da Vinci" },
  { daysAgo: 34, hour: 19, minute: 40, drinkType: "Beer", beerName: "Tripel Trouble", venue: V.gollem.name },
  { daysAgo: 48, hour: 18, minute: 0, drinkType: "Beer", beerName: "Weekend Lager", venue: "Café Thijssen" },
  { daysAgo: 62, hour: 20, minute: 0, drinkType: "Beer", beerName: "Guinness", venue: "Bar Bukowski" },
  { daysAgo: 76, hour: 19, minute: 0, drinkType: "Beer", beerName: "Hertog Jan", venue: V.taphouse.name },
];

// A couple of followed crew-mates so the feed and crew leaderboard aren't
// a single row. joinedAtDaysAgo drives the "since you joined" scoring.
const MEMBERS = [
  {
    username: "sanne_b",
    email: "sanne@demo.birava",
    joinedAtDaysAgo: 21,
    checkins: [
      { daysAgo: 3, hour: 19, minute: 0, drinkType: "Beer", beerName: "Après Pils", venue: "La Folie Douce" },
      { daysAgo: 3, hour: 20, minute: 0, drinkType: "Beer", beerName: "Glühbier", venue: "La Folie Douce" },
      { daysAgo: 8, hour: 18, minute: 0, drinkType: "Wine", beerName: "Côtes du Rhône", venue: "Chalet Bar" },
      { daysAgo: 14, hour: 19, minute: 0, drinkType: "Beer", beerName: "Kasteel Donker", venue: V.taphouse.name },
    ] as Seeded[],
  },
  {
    username: "niels_v",
    email: "niels@demo.birava",
    joinedAtDaysAgo: 14,
    checkins: [
      { daysAgo: 2, hour: 12, minute: 0, drinkType: "Beer", beerName: "Airport Lager", venue: "Schiphol Lounge" },
      { daysAgo: 2, hour: 12, minute: 20, drinkType: "Beer", beerName: "Duty Free IPA", venue: "Schiphol Lounge" },
      { daysAgo: 6, hour: 21, minute: 0, drinkType: "Cocktail", beerName: "Espresso Martini", venue: "Bar Oldenhof" },
    ] as Seeded[],
  },
];

const CREW = { name: "Amsterdam Beer Club", inviteCode: "AMS2026", ownerJoinedDaysAgo: 56 };

async function uploadPhotos(userId: string) {
  const assets: Record<string, string> = {
    grass: "grass-bottle.jpg",
    pint: "pint-table.jpg",
    party: "party-cup.jpg",
  };
  const urls: Record<string, string> = {};
  for (const [key, file] of Object.entries(assets)) {
    const bytes = await readFile(
      path.join(process.cwd(), "prisma", "seed-assets", file)
    );
    const upload = new File([new Uint8Array(bytes)], file, { type: "image/jpeg" });
    urls[key] = (await drinkPhotoService.store(upload, userId)).url;
  }
  return urls;
}

async function createUser(username: string, email: string, password: string) {
  return db.user.create({
    data: { username, email, passwordHash: await hashPassword(password) },
  });
}

// DrinkEntry.sessionId is required at creation, so each check-in needs its
// session decided before it's inserted — not after, the way a live check-in
// would attach via createDrinkEntry(). Since the whole batch is known
// upfront, it's simplest to pre-generate ids, cluster the batch in-memory
// with the same groupIntoSessions() the app uses, then insert sessions
// before the check-ins that reference them.
async function insertCheckins(
  userId: string,
  checkins: Seeded[],
  photoUrls: Record<string, string> = {}
) {
  // Resolved sequentially, not in parallel — resolveVenueId is a
  // find-or-create; concurrent calls for the same not-yet-created venue
  // name could race and create duplicates (fine to avoid, cheap here since
  // this only ever runs a couple dozen times per seed run).
  const prepared: Array<{
    id: string;
    userId: string;
    drinkName: string;
    drinkType: DrinkType;
    venueId: string | null;
    photoUrl: string | null;
    createdAt: Date;
  }> = [];
  const asDto: DrinkEntryDTO[] = [];

  for (const c of checkins) {
    const id = randomUUID();
    const createdAt = at(c.daysAgo, c.hour, c.minute);
    const photoUrl = c.photo ? (photoUrls[c.photo] ?? null) : null;
    const venueId = await resolveVenueId(db, c.venue, c.lat ?? null, c.lng ?? null);

    prepared.push({ id, userId, drinkName: c.beerName, drinkType: c.drinkType, venueId, photoUrl, createdAt });
    asDto.push({
      id,
      user_id: userId,
      // Not yet known — groupIntoSessions is what computes session
      // membership from these entries in the first place, and doesn't read
      // this field itself. The real id (sessionIdByEntryId) is what actually
      // gets written below.
      session_id: id,
      drink_name: c.beerName,
      drink_type: c.drinkType,
      venue: c.venue,
      lat: c.lat ?? null,
      lng: c.lng ?? null,
      photo_url: photoUrl,
      photo_lqip: null,
      created_at: createdAt.toISOString(),
    });
  }

  const sessions = groupIntoSessions(asDto);
  const sessionIdByEntryId = new Map(
    sessions.flatMap((s) => s.checkins.map((c) => [c.id, s.id] as const))
  );

  await db.$transaction([
    ...sessions.map((s) =>
      db.drinkSession.create({
        data: { id: s.id, userId, startedAt: new Date(s.start), endedAt: new Date(s.end) },
      })
    ),
    ...prepared.map((p) =>
      db.drinkEntry.create({
        data: { ...p, sessionId: sessionIdByEntryId.get(p.id)! },
      })
    ),
  ]);
}

async function main() {
  const shouldSeed =
    process.env.SEED_DEMO === "true" || process.env.VERCEL_ENV === "preview";
  if (!shouldSeed) {
    console.log(
      "[seed] Skipped — set SEED_DEMO=true or deploy as a Vercel preview/staging build to run."
    );
    return;
  }

  const existing = await db.user.findUnique({ where: { email: DEMO.email } });
  if (existing && existing.username !== DEMO.username) {
    console.log(
      `[seed] Skipped — ${DEMO.email} already belongs to "${existing.username}", not touching it.`
    );
    return;
  }
  if (existing) {
    const count = await db.drinkEntry.count({ where: { userId: existing.id } });
    if (count > 0) {
      console.log("[seed] Skipped — demo account already seeded.");
      return;
    }
  }

  console.log("[seed] Seeding demo account…");
  const demo =
    existing ?? (await createUser(DEMO.username, DEMO.email, DEMO.password));

  const photoUrls = await uploadPhotos(demo.id);
  await insertCheckins(demo.id, DEMO_CHECKINS, photoUrls);

  // Crew-mates the demo account follows + a shared crew
  const memberRows = [];
  for (const m of MEMBERS) {
    const user =
      (await db.user.findUnique({ where: { email: m.email } })) ??
      (await createUser(m.username, m.email, DEMO.password));
    await insertCheckins(user.id, m.checkins);
    await db.follow.upsert({
      where: {
        followerId_followingId: { followerId: demo.id, followingId: user.id },
      },
      update: {},
      create: { followerId: demo.id, followingId: user.id },
    });
    memberRows.push({ user, joinedAtDaysAgo: m.joinedAtDaysAgo });
  }

  const crew = await db.group.create({
    data: {
      name: CREW.name,
      inviteCode: CREW.inviteCode,
      ownerId: demo.id,
      members: {
        create: [
          { userId: demo.id, joinedAt: at(CREW.ownerJoinedDaysAgo, 12, 0) },
          ...memberRows.map((m) => ({
            userId: m.user.id,
            joinedAt: at(m.joinedAtDaysAgo, 12, 0),
          })),
        ],
      },
    },
  });

  console.log(
    `[seed] Done — ${DEMO.username} (${DEMO.email}) with ${DEMO_CHECKINS.length} check-ins, ${MEMBERS.length} crew-mates, crew "${crew.name}" (${crew.inviteCode}).`
  );
}

main()
  .catch((err) => {
    console.error("[seed] Failed:", err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
