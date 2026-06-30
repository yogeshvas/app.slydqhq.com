import { z } from "zod";
import {
  MEDIA_MAX_TAGS,
  MEDIA_PAGE_SIZE_MAX,
  MEDIA_SOURCES,
} from "../config/constants";

// `validate` middleware parses `{ body, query, params }`, so schemas wrap them.

export const listMediaSchema = z.object({
  query: z.object({
    source: z.enum(MEDIA_SOURCES).optional(),
    q: z.string().trim().max(200).optional(),
    // Comma-separated tag filter (AND), parsed in the controller.
    tags: z.string().optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(MEDIA_PAGE_SIZE_MAX).optional(),
  }),
});

export const uploadUrlSchema = z.object({
  body: z.object({
    filename: z.string().min(1, "A filename is required.").max(255),
    contentType: z.string().min(1, "A content type is required."),
    bytes: z.coerce.number().int().min(1, "File appears to be empty."),
  }),
});

export const registerUploadSchema = z.object({
  body: z.object({
    key: z.string().min(1),
    url: z.string().url(),
    filename: z.string().max(255).optional(),
    contentType: z.string().optional(),
    bytes: z.coerce.number().int().min(0).optional(),
    width: z.coerce.number().int().min(0).optional(),
    height: z.coerce.number().int().min(0).optional(),
  }),
});

export const mediaIdSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});

export const updateTagsSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    tags: z.array(z.string().max(40)).max(MEDIA_MAX_TAGS),
  }),
});
