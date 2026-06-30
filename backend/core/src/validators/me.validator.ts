import { z } from "zod";

export const updateMeSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(1).max(60).optional(),
      avatar: z.string().url().or(z.literal("")).optional(),
    })
    .refine((b) => b.name !== undefined || b.avatar !== undefined, {
      message: "Provide a name and/or avatar.",
    }),
});

export const avatarUploadSchema = z.object({
  body: z.object({
    filename: z.string().min(1).max(255),
    contentType: z.string().min(1),
    bytes: z.coerce.number().int().min(1),
  }),
});
