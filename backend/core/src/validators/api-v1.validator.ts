import { z } from "zod";
import { EXPORT_FORMATS, MAX_SLIDES, MIN_SLIDES } from "../config/constants";

export const generationSchema = z.object({
  body: z.object({
    prompt: z.string().min(3, "A prompt is required."),
    noOfSlides: z.coerce
      .number()
      .int()
      .min(MIN_SLIDES, `Minimum ${MIN_SLIDES} slides.`)
      .max(MAX_SLIDES, `Maximum ${MAX_SLIDES} slides.`)
      .optional(),
    deckType: z.string().optional(),
    theme: z.string().optional(),
    canvas: z.string().optional(),
    accentColor: z.string().optional(),
    outline: z.any().optional(),
    exports: z.array(z.enum(EXPORT_FORMATS)).max(3).optional(),
    includeSlides: z.boolean().optional(),
  }),
});

export const generationIdSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});
