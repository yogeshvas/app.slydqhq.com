import { z } from "zod";

export const rechargeSchema = z.object({
  body: z.object({ packId: z.string().min(1, "Pick a recharge pack.") }),
});

export const ledgerSchema = z.object({
  query: z.object({ page: z.coerce.number().int().min(1).optional() }),
});
