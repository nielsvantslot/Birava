import { db } from "@/lib/db";
import { createDrinkEntry } from "@/lib/commands/drinkEntryCommands";

const HOUR = 60 * 60 * 1000;

/**
 * Seeds `count` single-check-in sessions for the given user, 6h apart (past
 * the 4h session gap, so each lands in its own session) and ending just
 * before "now". Real-time entries other specs create for this shared fixed
 * e2e account always sort after these, so pagination order here stays
 * deterministic regardless of what else has run first.
 *
 * `drinkName` doubles as the visible marker: a lone check-in's session title
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
  const actor = { username: user.username, avatarUrl: user.avatarUrl };
  const names: string[] = [];
  const newest = Date.now() - 60 * 1000;

  for (let i = 0; i < count; i++) {
    const name = `${labelPrefix} ${i}`;
    names.push(name);
    const result = await createDrinkEntry(
      user.id,
      {
        drinkName: name,
        drinkType: "Beer",
        venue: null,
        lat: null,
        lng: null,
        notes: null,
        photoUrl: null,
        photoLqip: null,
        createdAt: newest - (count - 1 - i) * 6 * HOUR,
      },
      actor
    );
    if (result.error) throw new Error(`Failed to seed session ${i}: ${result.error}`);
  }

  return names;
}
