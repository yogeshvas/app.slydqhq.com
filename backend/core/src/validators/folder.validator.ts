import { z } from "zod";

export const createFolderSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, "A folder name is required.").max(80),
    color: z.string().max(20).optional(),
  }),
});

export const updateFolderSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z
    .object({
      name: z.string().trim().max(80).optional(),
      color: z.string().max(20).optional(),
    })
    .refine((b) => b.name !== undefined || b.color !== undefined, {
      message: "Provide a name and/or color.",
    }),
});

export const folderIdSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});

export const moveDeckSchema = z.object({
  params: z.object({ id: z.string().min(1, "Deck id is required.") }),
  body: z.object({ folderId: z.string().nullable() }),
});
