import { z } from "zod";
import { ContractFields } from "@/lib/gateway/ContractFields";
import { DRINK_TYPES } from "@/lib/types";

const { id, nullable } = ContractFields;

/** The fields a check-in form submits, shared by create and edit. */
const checkinFields = {
  drinkName: nullable(z.string().max(200)),
  drinkType: z.enum(DRINK_TYPES),
  venue: nullable(z.string().max(200)),
  lat: nullable(z.number().min(-90).max(90)),
  lng: nullable(z.number().min(-180).max(180)),
  photoUrl: nullable(z.string().max(2048)),
  photoLqip: nullable(z.string().max(20_000)),
};

/** `addDrink`: log a check-in. */
export const createCheckinInput = z.object({
  ...checkinFields,
  /** Client epoch ms for offline-sync; the server clamps it to its trust window. */
  createdAt: z.number().finite().nullish(),
  /** The offline queue's own id, doubling as an idempotency key. */
  clientId: id.nullish(),
});

/** `editDrink`. */
export const updateCheckinInput = z.object({ id, ...checkinFields });

/** `deleteDrink`. */
export const deleteCheckinInput = z.object({ id });

/** `GET /api/feed`: one page of the dashboard feed. Both cursor halves are set, or neither. */
export const feedQuery = z.object({
  onlyOwn: z.enum(["true", "false"]).transform((v) => v === "true"),
  beforeEndedAt: z.iso.datetime({ offset: true }).optional(),
  beforeId: id.optional(),
});
