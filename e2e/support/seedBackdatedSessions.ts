import { randomUUID } from "crypto";
import { db } from "@/lib/db";

const HOUR = 60 * 60 * 1000;

/**
 * Seeds `count` single-check-in sessions for the given user, 6h apart (past
 * the 4h session gap, so each lands in its own session) and ending just
 * before "now" — the caller is expected to be a freshly created user (see
 * session-pagination.spec.ts), so there's nothing else to stay clear of.
 *
 * Writes DrinkSession/DrinkEntry rows directly instead of going through
 * createDrinkEntry: that command calls getUserTimeZone(), which reads
 * next/headers's cookies() — real only inside an actual Next.js request,
 * which a Playwright test's own Node process never has.
 *
 * drinkName doubles as the visible marker: a lone check-in's session title
 * is its drinkName (see sessionTitle in lib/sessions.ts), so each seeded
 * session is locatable on the dashboard by its exact `${labelPrefix} ${i}`
 * text. Returns the names oldest-first — the last one is the newest.
 */
export async function seedBackdatedSessions(
  email: string,
  count: number,
  labelPrefix: string
): Promise<string[]> {
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  const names: string[] = [];
  const newest = Date.now() - 60 * 1000;

  for (let i = 0; i < count; i++) {
    const name = `${labelPrefix} ${i}`;
    names.push(name);
    const createdAt = new Date(newest - (count - 1 - i) * 6 * HOUR);
    const sessionId = randomUUID();

    await db.drinkSession.create({
      data: { id: sessionId, userId: user.id, startedAt: createdAt, endedAt: createdAt },
    });
    await db.drinkEntry.create({
      data: {
        userId: user.id,
        sessionId,
        drinkName: name,
        drinkType: "Beer",
        createdAt,
      },
    });
  }

  return names;
}
