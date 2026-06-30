import { Asset } from "../models/content/asset.model";
import { env } from "../config/env";
import {
  MEDIA_MAX_TAGS,
  MEDIA_MAX_TAG_LEN,
  MEDIA_PAGE_SIZE,
  MEDIA_PAGE_SIZE_MAX,
  MIME_EXTENSIONS,
  type MediaSource,
} from "../config/constants";
import ApiError from "../utils/appError";
import { logger } from "../utils/logger";
import {
  deleteObject,
  isStorageConfigured,
  presignUpload,
} from "./storage.service";

type AnyDoc = Record<string, any> & { save(): Promise<unknown> };

/** Normalise a tag list: trim, lowercase, dedupe, cap length + count. */
function cleanTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const out = new Set<string>();
  for (const t of tags) {
    const v = String(t).trim().toLowerCase().slice(0, MEDIA_MAX_TAG_LEN);
    if (v) out.add(v);
    if (out.size >= MEDIA_MAX_TAGS) break;
  }
  return [...out];
}

/**
 * Ask the ai-engine to describe an image (vision) and persist the resulting
 * searchable metadata. Fire-and-forget: never blocks the caller, never throws.
 */
async function enrichAssetMetadata(assetId: unknown, imageUrl: string) {
  try {
    const resp = await fetch(`${env.AI_ENGINE_URL}/image/describe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl }),
    });
    const body: any = await resp.json().catch(() => null);
    if (resp.ok && body && typeof body.title === "string") {
      await Asset.findByIdAndUpdate(assetId, {
        title: body.title ?? "",
        description: body.description ?? "",
        aiTags: cleanTags(body.tags),
        metaStatus: "ready",
      });
    } else {
      logger.warn(
        { assetId, status: resp.status, engineError: body?.error },
        "Image metadata enrichment failed",
      );
      await Asset.findByIdAndUpdate(assetId, { metaStatus: "failed" });
    }
  } catch (err) {
    logger.warn({ err, assetId }, "Image metadata enrichment errored");
    await Asset.findByIdAndUpdate(assetId, { metaStatus: "failed" }).catch(
      () => {},
    );
  }
}

export interface RecordAssetInput {
  workspaceId: unknown;
  authorId?: unknown;
  url: string;
  source: MediaSource | "export";
  deckId?: unknown;
  slideId?: unknown;
  prompt?: string;
  unsplashId?: string;
  storageKey?: string;
  mime?: string;
  width?: number;
  height?: number;
  bytes?: number;
  originalFilename?: string;
  /** A known title to seed (e.g. the slide title for generated images). */
  title?: string;
  /**
   * Run the AI vision describe to derive title/description/tags. Default true.
   * Bulk-generation slide images pass `false` — they're already searchable by
   * their prompt + title, so we skip the (per-image, unmetered) vision call.
   */
  enrich?: boolean;
}

/**
 * Catalogue an image into the workspace media library. Deduped by (workspace, url)
 * so regenerating/reusing the same image doesn't create duplicates. New assets get
 * AI metadata enriched asynchronously. Safe to call fire-and-forget from any image
 * flow — it resolves to the asset (existing or new).
 */
export async function recordAsset(input: RecordAssetInput) {
  if (!input.url || !String(input.url).trim()) return null;

  const existing = await Asset.findOne({
    workspaceId: input.workspaceId,
    url: input.url,
  });
  if (existing) return existing;

  const enrich = input.enrich !== false;
  const asset = (await Asset.create({
    workspaceId: input.workspaceId,
    authorId: input.authorId,
    type: "image",
    url: input.url,
    storageKey: input.storageKey,
    source: input.source,
    deckId: input.deckId,
    slideId: input.slideId,
    mime: input.mime,
    width: input.width,
    height: input.height,
    bytes: input.bytes,
    originalFilename: input.originalFilename,
    title: input.title ?? "",
    // "ready" (no work pending) when we're not enriching — avoids a permanent
    // "Analyzing…" state on bulk-generation images.
    metaStatus: enrich ? "pending" : "ready",
    meta: { prompt: input.prompt, unsplashId: input.unsplashId },
  })) as unknown as AnyDoc;

  // Enrich in the background — don't make the calling request wait on vision.
  if (enrich) void enrichAssetMetadata(asset._id, input.url);
  return asset;
}

/** Fire-and-forget catalogue: log but never propagate errors to the caller. */
export function captureAsset(input: RecordAssetInput): void {
  recordAsset(input).catch((err) =>
    logger.warn({ err, source: input.source }, "captureAsset failed"),
  );
}

export interface ListAssetsParams {
  workspaceId: unknown;
  source?: MediaSource;
  q?: string;
  tags?: string[];
  page?: number;
  limit?: number;
}

/**
 * Server-side, indexed search over a workspace's library. Text query uses the
 * Mongo `$text` index (ranked by relevance); tag filters use `$all`; results are
 * paginated. Never loads the whole library into memory.
 */
export async function listAssets(params: ListAssetsParams) {
  const limit = Math.min(
    Math.max(params.limit ?? MEDIA_PAGE_SIZE, 1),
    MEDIA_PAGE_SIZE_MAX,
  );
  const page = Math.max(params.page ?? 1, 1);

  const filter: Record<string, unknown> = { workspaceId: params.workspaceId };
  if (params.source) filter.source = params.source;
  const tags = cleanTags(params.tags);
  if (tags.length) filter.tags = { $all: tags };

  const q = params.q?.trim();
  let query;
  if (q) {
    filter.$text = { $search: q };
    query = Asset.find(filter, { score: { $meta: "textScore" } }).sort({
      score: { $meta: "textScore" },
      createdAt: -1,
    });
  } else {
    query = Asset.find(filter).sort({ createdAt: -1 });
  }

  const [items, total] = await Promise.all([
    query
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Asset.countDocuments(filter),
  ]);

  return { items, total, page, limit, hasMore: page * limit < total };
}

/** Distinct tags used in a workspace (for the tag filter UI). */
export async function listWorkspaceTags(workspaceId: unknown): Promise<string[]> {
  const [user, ai] = await Promise.all([
    Asset.distinct("tags", { workspaceId }),
    Asset.distinct("aiTags", { workspaceId }),
  ]);
  return [...new Set<string>([...user, ...ai].map((t) => String(t)))].sort();
}

export interface CreateUploadInput {
  filename: string;
  contentType: string;
  bytes: number;
}

/** Validate an intended upload and mint a presigned PUT URL for it. */
export function createUpload(workspaceId: string, input: CreateUploadInput) {
  if (!isStorageConfigured()) {
    throw ApiError.serviceUnavailable(
      "Uploads aren't available yet — object storage isn't configured.",
    );
  }
  if (!MIME_EXTENSIONS[input.contentType]) {
    throw ApiError.badRequest(
      "Unsupported image type. Use PNG, JPEG, WEBP, GIF, SVG or AVIF.",
    );
  }
  if (input.bytes > env.UPLOAD_MAX_BYTES) {
    const mb = Math.round(env.UPLOAD_MAX_BYTES / (1024 * 1024));
    throw ApiError.badRequest(`File too large — the limit is ${mb}MB.`);
  }
  return presignUpload(workspaceId, input.contentType);
}

export interface RegisterUploadInput {
  workspaceId: unknown;
  authorId: unknown;
  key: string;
  url: string;
  filename?: string;
  contentType?: string;
  bytes?: number;
  width?: number;
  height?: number;
}

/** Record an uploaded object as an Asset once the browser has PUT it to storage. */
export async function registerUpload(input: RegisterUploadInput) {
  const asset = await recordAsset({
    workspaceId: input.workspaceId,
    authorId: input.authorId,
    url: input.url,
    source: "upload",
    storageKey: input.key,
    mime: input.contentType,
    bytes: input.bytes,
    width: input.width,
    height: input.height,
    originalFilename: input.filename,
  });
  return asset;
}

/** Replace an asset's user tags (scoped to its workspace). */
export async function updateAssetTags(
  assetId: string,
  workspaceId: unknown,
  tags: string[],
) {
  const asset: any = await Asset.findOneAndUpdate(
    { _id: assetId, workspaceId },
    { tags: cleanTags(tags) },
    { new: true },
  ).lean();
  if (!asset) throw ApiError.notFound("Media item not found.");
  return asset;
}

/** Delete an asset (and its stored blob, for uploads), scoped to its workspace. */
export async function deleteAsset(assetId: string, workspaceId: unknown) {
  const asset: any = await Asset.findOne({ _id: assetId, workspaceId });
  if (!asset) throw ApiError.notFound("Media item not found.");
  if (asset.storageKey) {
    await deleteObject(asset.storageKey).catch((err) =>
      logger.warn({ err, assetId }, "Failed to delete stored blob"),
    );
  }
  await Asset.deleteOne({ _id: assetId, workspaceId });
  return { ok: true };
}
