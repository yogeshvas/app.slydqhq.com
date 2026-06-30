import { Deck } from "../models/content/deck.model";
import { Slide } from "../models/content/slide.model";
import { Export } from "../models/generation/export.model";
import { Asset } from "../models/content/asset.model";
import { env } from "../config/env";
import { EXPORT_EXT, EXPORT_MIME, type ExportFormat } from "../config/constants";
import ApiError from "../utils/appError";
import { logger } from "../utils/logger";
import {
  buildExportKey,
  isStorageConfigured,
  putObject,
} from "./storage.service";

/** Render options derived from the deck (theme, canvas, accent). */
function deckRenderOpts(deck: any) {
  return {
    theme: deck.theme as string,
    canvas: deck.canvas as string,
    accentColor: (deck.accentColor?.name ?? deck.accentColor?.hex) as
      | string
      | undefined,
  };
}

/**
 * Export a deck to PDF/PPTX: send its persisted slides (structured content) to
 * the engine, receive the file bytes, upload to object storage, and record an
 * Export + Asset. Returns the downloadable URL. Stateless w.r.t. the engine.
 */
export async function exportDeck(
  deckId: string,
  workspaceId: unknown,
  userId: string | undefined,
  format: ExportFormat,
  // Optional 1-based slide numbers to include (a custom range); all when omitted.
  slideNumbers?: number[],
) {
  if (!isStorageConfigured()) {
    throw ApiError.serviceUnavailable(
      "Exports aren't available yet — object storage isn't configured.",
    );
  }

  const deck = await Deck.findOne({ _id: deckId, workspaceId, deletedAt: null });
  if (!deck) throw ApiError.notFound("Deck not found.");

  const allSlides = await Slide.find({ deckId, deletedAt: null })
    .sort({ position: 1 })
    .lean();
  if (allSlides.length === 0) {
    throw ApiError.badRequest("This deck has no slides to export.");
  }

  // Number slides by render order, then optionally keep only the requested subset.
  const numbered = allSlides.map((s: any, i: number) => ({ s, n: i + 1 }));
  const wanted = slideNumbers && slideNumbers.length ? new Set(slideNumbers) : null;
  const selected = wanted ? numbered.filter((x) => wanted.has(x.n)) : numbered;
  if (selected.length === 0) {
    throw ApiError.badRequest("That card range doesn't match any slides.");
  }

  // The engine renders from structured content; fall back to a minimal shape for
  // legacy slides. Renumber selected slides 1..k so the export is contiguous.
  const engineSlides = selected.map(({ s }, i: number) => {
    const content =
      s.content && typeof s.content === "object" && Object.keys(s.content).length
        ? s.content
        : { slideType: s.layout, title: s.title, recommendedLayout: s.layout };
    return { ...content, slideNumber: i + 1 };
  });

  const record = (await Export.create({
    deckId,
    workspaceId,
    format,
    status: "pending",
    requestedBy: userId,
  })) as any;

  try {
    const resp = await fetch(`${env.AI_ENGINE_URL}/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        format,
        deckTitle: (deck as any).title,
        storyTheme: (deck as any).storyTheme ?? "",
        slides: engineSlides,
        ...deckRenderOpts(deck),
      }),
    });
    if (!resp.ok) {
      const err: any = await resp.json().catch(() => null);
      logger.error(
        { status: resp.status, engineError: err?.error, deckId, format },
        "ai-engine /export failed",
      );
      throw ApiError.serviceUnavailable(
        err?.error ? `Export failed: ${err.error}` : "Export failed. Try again.",
      );
    }

    const bytes = Buffer.from(await resp.arrayBuffer());
    const key = buildExportKey(String(workspaceId), String(deckId), EXPORT_EXT[format]);
    const url = await putObject(key, bytes, EXPORT_MIME[format]);

    const asset = (await Asset.create({
      workspaceId,
      authorId: userId,
      // Asset.type enum is image|pdf|pptx; a png-zip is recorded as "image".
      type: format === "pdf" ? "pdf" : format === "pptx" ? "pptx" : "image",
      url,
      storageKey: key,
      source: "export",
      deckId,
      bytes: bytes.length,
      mime: EXPORT_MIME[format],
      metaStatus: "ready",
    })) as any;

    record.status = "ready";
    record.assetId = asset._id;
    await record.save();

    return { exportId: String(record._id), format, url, status: "ready" };
  } catch (err) {
    record.status = "error";
    await record.save().catch(() => {});
    if (err instanceof ApiError) throw err;
    logger.error({ err, deckId, format }, "exportDeck failed");
    throw ApiError.serviceUnavailable("Export failed. Please try again.");
  }
}

/** A deck's export history (newest first). */
export async function listDeckExports(deckId: string, workspaceId: unknown) {
  const exports = await Export.find({ deckId, workspaceId, status: "ready" })
    .sort({ createdAt: -1 })
    .populate("assetId", "url")
    .lean();
  return exports.map((e: any) => ({
    _id: String(e._id),
    format: e.format,
    url: e.assetId?.url ?? null,
    createdAt: e.createdAt,
  }));
}
