import { z } from "zod";
import { EXPORT_FORMATS } from "../config/constants";

export const viewPublicDeckSchema = z.object({
  params: z.object({ token: z.string().min(1) }),
  body: z.object({ password: z.string().max(200).optional() }),
});

export const exportPublicDeckSchema = z.object({
  params: z.object({ token: z.string().min(1) }),
  body: z.object({
    format: z.enum(EXPORT_FORMATS),
    password: z.string().max(200).optional(),
    slideNumbers: z.array(z.number().int().min(1)).optional(),
  }),
});
