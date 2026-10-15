import type { PendingCheckinPayload } from "./PendingCheckin";

export type CheckinSendRequest = PendingCheckinPayload & {
  photoUrl: string | null;
  photoLqip: string | null;
  /** When the check-in was logged on the device (epoch ms); the server clamps it. */
  createdAt: number;
  /** The queue entry's own id, reused by the server as the check-in's id so a retry can never create a second one. */
  clientId: string;
};

export type CheckinSendResult =
  | { ok: true; achievementUnlocked: boolean }
  /** `transient`: the server said "not now" (rate limited, upstream down), so the entry stays queued; otherwise it is a definitive no. */
  | { ok: false; error: string; transient: boolean };

/** Sends one check-in to the server. The web implementation calls the addDrink server action; a native client calls POST /api/v1/checkins. */
export interface ICheckinSender {
  send(request: CheckinSendRequest): Promise<CheckinSendResult>;
}
