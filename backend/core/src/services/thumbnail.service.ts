import { Deck } from "../models/content/deck.model";
import { Slide } from "../models/content/slide.model";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import { isStorageConfigured, putObject, publicUrl } from "./storage.service";

/** Object key for a deck's slide-1 thumbnail (one per deck, overwritten on update). */
function thumbnailKey(workspaceId: string, deckId: string): string {
  return `thumbnails/${workspaceId}/${deckId}.webp`;
}

/**
 * Render a deck's slide-1 to a small WEBP and store it on the deck as
 * `thumbnailUrl`, so the dashboard list can ship a tiny <img> URL instead of the
 * slide's full HTML + the deck stylesheet. Best-effort: never throws (callers
 * fire-and-forget); returns the URL on success, null otherwise.
 *
 * Cache-busted with a `?v=` timestamp so the browser re-fetches after an update
 * even though the object key is stable.
 */
export async function generateDeckThumbnail(
  deckId: string,
  workspaceId: unknown,
): Promise<string | null> {
  if (!isStorageConfigured()) return null;

  try {
    const deck = (await Deck.findOne({
      _id: deckId,
      workspaceId,
      deletedAt: null,
    }).lean()) as any;
    if (!deck) return null;

    // Slide 1 in render order — its cached `html` fragment + the deck stylesheet
    // is exactly what the viewer renders, so the thumbnail is pixel-accurate.
    const first = (await Slide.findOne({ deckId, deletedAt: null })
      .sort({ position: 1 })
      .select("html")
      .lean()) as any;
    if (!first?.html) return null;

    const resp = await fetch(`${env.AI_ENGINE_URL}/thumbnail`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        html: first.html,
        css: deck.styleCss ?? "",
        canvas: deck.canvas,
      }),
    });
    if (!resp.ok) {
      logger.warn({ deckId, status: resp.status }, "thumbnail render failed");
      return null;
    }

    const bytes = Buffer.from(await resp.arrayBuffer());
    const key = thumbnailKey(String(workspaceId), String(deckId));
    await putObject(key, bytes, "image/webp");
    const url = `${publicUrl(key)}?v=${Date.now()}`;

    await Deck.updateOne({ _id: deckId, workspaceId }, { thumbnailUrl: url });
    logger.info({ deckId, bytes: bytes.length }, "deck thumbnail generated");
    return url;
  } catch (err) {
    logger.warn({ err, deckId }, "generateDeckThumbnail failed (non-fatal)");
    return null;
  }
}

/** Fire-and-forget thumbnail (re)generation — for use after generation/edits. */
export function queueDeckThumbnail(deckId: string, workspaceId: unknown): void {
  void generateDeckThumbnail(deckId, workspaceId);
}
