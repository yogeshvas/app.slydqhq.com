import { z } from "zod";

export const feedbackSchema = z.object({
  body: z.object({
    message: z
      .string()
      .trim()
      .min(5, "Please write a little more so we can help.")
      .max(2000, "That's a bit long — please keep it under 2000 characters."),
    category: z.string().trim().max(40).optional(),
  }),
});
