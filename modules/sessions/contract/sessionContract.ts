import { z } from "zod";
import { ContractFields } from "@/lib/gateway/ContractFields";

/** `renameSession`: an empty or null name clears the custom name. The 40-character product rule lives in the command; this only bounds absurd input. */
export const renameSessionInput = z.object({
  id: ContractFields.id,
  name: ContractFields.nullable(z.string().max(1000)),
});
