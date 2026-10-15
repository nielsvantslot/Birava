/** Tells the person what the sync did. The web implementation shows a toast and confetti; a native client does its own thing. */
export interface IOutboxNotifier {
  synced(): void;
  achievementUnlocked(): void;
}
