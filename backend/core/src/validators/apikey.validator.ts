import { z } from "zod";

export const createKeySchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, "A key name is required.").max(80),
    budgetCredits: z.coerce.number().int().min(1).nullable().optional(),
  }),
});

export const updateKeySchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z
    .object({
      name: z.string().trim().max(80).optional(),
      budgetCredits: z.coerce.number().int().min(1).nullable().optional(),
      enabled: z.boolean().optional(),
    })
    .refine(
      (b) =>
        b.name !== undefined ||
        b.budgetCredits !== undefined ||
        b.enabled !== undefined,
      { message: "Provide a field to update." },
    ),
});

export const keyIdSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});
