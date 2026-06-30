import { z } from "zod";
import {
  DECK_PAGE_SIZE_MAX,
  EXPORT_FORMATS,
  MAX_SLIDES,
  MIN_SLIDES,
} from "../config/constants";

// Shared deck-shaping config (prompt + options).
const deckConfig = {
  prompt: z.string().min(3, "Tell us what to create."),
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
  // The OpenAI model picked in the UI (stored with the outline; cosmetic for now).
  model: z.string().optional(),
};

// An approved outline to build the deck from (titles + bullets).
const outlineSchema = z.object({
  deckTitle: z.string().optional(),
  storyTheme: z.string().optional(),
  // Strategist analysis round-tripped to the engine so the content stage keeps
  // the same context as the direct-prompt path. Shape is engine-owned.
  analysis: z.any().optional(),
  outlineId: z.string().optional(),
  slides: z.array(
    z.object({
      slideNumber: z.number(),
      title: z.string(),
      bullets: z.array(z.string()),
      // Semantic role assigned by the outline agent — threaded to the engine so the
      // layout selector can pick varied, fitting layouts. Optional (older outlines).
      slideType: z.string().optional(),
    }),
  ),
});

// `validate` middleware parses `{ body, query, params }`, so schemas wrap them.
export const generateOutlineSchema = z.object({
  body: z.object(deckConfig),
});

export const generateDeckSchema = z.object({
  body: z.object({
    ...deckConfig,
    outline: outlineSchema.optional(),
  }),
});

// Generate a single outline card that fits the current deck.
export const outlineCardSchema = z.object({
  body: z.object({
    prompt: z.string().min(1, "A prompt is required."),
    deckTitle: z.string().optional(),
    storyTheme: z.string().optional(),
    deckType: z.string().optional(),
    existingTitles: z.array(z.string()).optional(),
    position: z.coerce.number().int().min(0).optional(),
    hint: z.string().optional(),
  }),
});

// Persist edits to a saved outline.
export const updateOutlineSchema = z.object({
  params: z.object({ id: z.string().min(1, "Outline id is required.") }),
  body: z.object({
    deckTitle: z.string().optional(),
    storyTheme: z.string().optional(),
    slides: z
      .array(
        z.object({
          slideNumber: z.number(),
          title: z.string(),
          bullets: z.array(z.string()),
        }),
      )
      .optional(),
  }),
});

export const listDecksSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(DECK_PAGE_SIZE_MAX).optional(),
    filter: z.enum(["all", "recent", "created", "favorites"]).optional(),
    sort: z.enum(["updated", "created", "title", "viewed"]).optional(),
    desc: z.enum(["true", "false"]).optional(),
    folderId: z.string().optional(),
  }),
});

export const searchDecksSchema = z.object({
  query: z.object({ q: z.string().trim().max(200).optional() }),
});

export const favoriteSchema = z.object({
  params: z.object({ id: z.string().min(1, "Deck id is required.") }),
  body: z.object({ favorite: z.boolean() }),
});

export const deckIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Deck id is required."),
  }),
});

const slideParams = z.object({
  id: z.string().min(1, "Deck id is required."),
  slideId: z.string().min(1, "Slide id is required."),
});

export const updateSlideSchema = z.object({
  params: slideParams,
  body: z.object({
    html: z.string().optional(),
    title: z.string().optional(),
    // Structured content — re-rendered server-side. Shape varies per layout.
    content: z.any().optional(),
    // Speaker notes — metadata, not re-rendered.
    notes: z.string().max(5000).optional(),
  }),
});

export const slideParamsSchema = z.object({ params: slideParams });

export const exportDeckSchema = z.object({
  params: z.object({ id: z.string().min(1, "Deck id is required.") }),
  body: z.object({
    format: z.enum(EXPORT_FORMATS),
    // Optional 1-based card numbers to include (custom range); all when omitted.
    slideNumbers: z.array(z.number().int().min(1)).optional(),
  }),
});

export const updateShareSchema = z.object({
  params: z.object({ id: z.string().min(1, "Deck id is required.") }),
  body: z.object({
    enabled: z.boolean().optional(),
    allowDownload: z.boolean().optional(),
    discoverable: z.boolean().optional(),
    // null/"" clears the password; a string sets it; undefined leaves it.
    password: z.string().max(200).nullable().optional(),
  }),
});

export const changeThemeSchema = z.object({
  params: z.object({ id: z.string().min(1, "Deck id is required.") }),
  body: z
    .object({
      theme: z.string().optional(),
      accentColor: z.string().optional(),
    })
    .refine((b) => b.theme !== undefined || b.accentColor !== undefined, {
      message: "Provide a theme and/or accent colour.",
    }),
});

export const updateDeckSchema = z.object({
  params: z.object({ id: z.string().min(1, "Deck id is required.") }),
  body: z.object({ title: z.string().min(1, "Title can't be empty.").optional() }),
});

export const reorderSlidesSchema = z.object({
  params: z.object({ id: z.string().min(1, "Deck id is required.") }),
  body: z.object({ slideIds: z.array(z.string().min(1)).min(1) }),
});

export const addSlideSchema = z.object({
  params: z.object({ id: z.string().min(1, "Deck id is required.") }),
  body: z.object({
    layout: z.string().optional(),
    afterSlideId: z.string().optional(),
    content: z.any().optional(),
  }),
});

export const aiEditSlideSchema = z.object({
  params: slideParams,
  body: z
    .object({
      instruction: z.string().max(2000).optional(),
      layout: z.string().optional(),
    })
    .refine((b) => Boolean(b.instruction?.trim()) || Boolean(b.layout), {
      message: "Provide an instruction and/or a layout.",
    }),
});

export const slideImageSchema = z.object({
  params: slideParams,
  body: z
    .object({
      prompt: z.string().optional(),
      source: z.enum(["ai", "unsplash"]).optional(),
      // A specific stock photo URL the user picked from the search results.
      imageUrl: z.string().url().optional(),
    })
    .refine((b) => Boolean(b.imageUrl) || (b.prompt?.trim().length ?? 0) >= 2, {
      message: "Describe the image you want, or pick one from the results.",
      path: ["prompt"],
    }),
});

// Search stock photos for the editor's picker.
export const stockSearchSchema = z.object({
  body: z.object({
    query: z.string().min(2, "Enter what to search for."),
    orientation: z.enum(["landscape", "portrait", "square"]).optional(),
  }),
});
