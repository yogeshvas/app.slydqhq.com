import { Deck } from "../models/content/deck.model";
import { Slide } from "../models/content/slide.model";
import { DeckView } from "../models/content/deck_view.model";
import { User } from "../models/identity/user.model";
import { env } from "../config/env";
import {
  DECK_PAGE_SIZE,
  DECK_PAGE_SIZE_MAX,
  IMAGE_LAYOUTS,
} from "../config/constants";
import {
  AI_EDIT_CREDITS as AI_EDIT_COST,
  AI_IMAGE_CREDITS as AI_IMAGE_COST,
} from "../config/pricing";
import ApiError from "../utils/appError";
import { logger } from "../utils/logger";
import { renderSlideContent, renderSlideContentWithCss } from "./generation.service";
import { recordCredit } from "./credit.service";
import { captureAsset } from "./media.service";

// Models are loosely typed (defineModel); cast docs to read/write fields.
type AnyDoc = Record<string, any> & { save(): Promise<unknown> };

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

async function requireDeck(deckId: string, workspaceId: unknown) {
  const deck = await Deck.findOne({ _id: deckId, workspaceId, deletedAt: null });
  if (!deck) throw ApiError.notFound("Deck not found.");
  return deck;
}

/** A deck (scoped to its workspace) plus its live slides in render order. */
export async function getDeckWithSlides(
  deckId: string,
  workspaceId: unknown,
  userId?: string,
) {
  const deck = (await requireDeck(deckId, workspaceId)).toObject() as any;
  const slides = await Slide.find({ deckId, deletedAt: null })
    .sort({ position: 1 })
    .lean();
  // Surface the current user's favorite state so the editor can show/toggle it.
  if (userId) {
    const view: any = await DeckView.findOne({ deckId, userId }).lean();
    deck.favorite = Boolean(view?.favorite);
  }
  return { deck, slides };
}

/** Update a deck's editable metadata (scoped to its workspace). */
export async function updateDeckMeta(
  deckId: string,
  workspaceId: unknown,
  patch: { title?: string },
) {
  const deck = (await requireDeck(deckId, workspaceId)) as unknown as AnyDoc;
  if (patch.title !== undefined) deck.title = patch.title;
  await deck.save();
  return deck;
}

/**
 * Update a slide. With `content` (structured edit) we re-render the HTML via the
 * engine; with `html` (raw text edit) we store it directly.
 */
export async function updateSlide(
  deckId: string,
  slideId: string,
  workspaceId: unknown,
  patch: { html?: string; title?: string; content?: any; notes?: string },
) {
  const deck = await requireDeck(deckId, workspaceId);
  const slide = (await Slide.findOne({
    _id: slideId,
    deckId,
    deletedAt: null,
  })) as unknown as AnyDoc | null;
  if (!slide) throw ApiError.notFound("Slide not found.");

  if (patch.content !== undefined) {
    slide.content = patch.content;
    slide.html = await renderSlideContent(patch.content, deckRenderOpts(deck));
    if (patch.content.title) slide.title = patch.content.title;
    if (patch.content.recommendedLayout) slide.layout = patch.content.recommendedLayout;
  } else if (patch.html !== undefined) {
    slide.html = patch.html;
  }
  if (patch.title !== undefined) slide.title = patch.title;
  // Notes are metadata — never trigger a re-render.
  if (patch.notes !== undefined) slide.notes = patch.notes;

  await slide.save();
  return slide;
}

/**
 * AI-edit a slide from a natural-language instruction and/or a new layout.
 * Charges credits, proxies the engine, persists the revised content + html.
 */
export async function aiEditSlide(
  deckId: string,
  slideId: string,
  workspaceId: unknown,
  args: { instruction?: string; layout?: string },
) {
  const deck = await requireDeck(deckId, workspaceId);
  const slide = (await Slide.findOne({
    _id: slideId,
    deckId,
    deletedAt: null,
  })) as unknown as AnyDoc | null;
  if (!slide) throw ApiError.notFound("Slide not found.");
  const c = slide.content;
  const hasStructured =
    c &&
    typeof c === "object" &&
    (c.title != null || c.description != null || c.bulletPoints != null);
  if (!hasStructured) {
    throw ApiError.badRequest(
      "This deck was generated before structured editing — regenerate it to edit slides with AI.",
    );
  }

  // Charge up front; refunded if the engine call fails.
  await recordCredit(workspaceId, -AI_EDIT_COST, "ai_edit", slide._id);
  try {
    const resp = await fetch(`${env.AI_ENGINE_URL}/slide/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slide: slide.content,
        instruction: args.instruction ?? "",
        layout: args.layout,
        // Deck-level context so AI edits stay on-topic (esp. "generate/expand"
        // instructions, which otherwise produce generic content).
        deckContext: {
          deckTitle: (deck as any).title ?? "",
          storyTheme: (deck as any).storyTheme ?? "",
          deckType: (deck as any).deckType ?? "",
        },
        ...deckRenderOpts(deck),
      }),
    });
    const body: any = await resp.json().catch(() => null);
    if (!resp.ok || !body?.html || !body?.slide) {
      logger.error(
        { status: resp.status, engineError: body?.error, body },
        "ai-engine /slide/edit failed",
      );
      throw ApiError.serviceUnavailable(
        body?.error
          ? `AI edit failed: ${body.error}`
          : "AI edit failed. Please try again.",
      );
    }

    slide.content = body.slide;
    slide.html = body.html;
    if (body.slide.title) slide.title = body.slide.title;
    if (body.slide.recommendedLayout) slide.layout = body.slide.recommendedLayout;
    await slide.save();
    // An AI edit may auto-fill an image (engine adds a free stock photo when a
    // layout needs one) — catalogue it into the media library.
    if (body.slide.imageUrl) {
      captureAsset({
        workspaceId,
        url: body.slide.imageUrl,
        source: "unsplash",
        deckId,
        slideId: slide._id,
      });
    }
    return slide;
  } catch (err) {
    await recordCredit(workspaceId, AI_EDIT_COST, "refund", slide._id);
    if (err instanceof ApiError) throw err;
    logger.error({ err, slideId }, "aiEditSlide failed");
    throw ApiError.serviceUnavailable("AI edit failed. Please try again.");
  }
}

/** Regenerate a slide's image from a prompt (AI illustration or Unsplash). */
/** Search stock photos (Unsplash) — returns several URLs for the editor's picker. */
export async function searchStockImages(
  query: string,
  orientation?: "landscape" | "portrait" | "square",
): Promise<string[]> {
  const resp = await fetch(`${env.AI_ENGINE_URL}/images/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, orientation: orientation ?? "landscape" }),
  });
  const body: any = await resp.json().catch(() => null);
  if (!resp.ok || !Array.isArray(body?.images)) {
    logger.error({ status: resp.status, body }, "ai-engine /images/search failed");
    throw ApiError.serviceUnavailable("Couldn't search photos. Try again.");
  }
  return body.images as string[];
}

export async function setSlideImage(
  deckId: string,
  slideId: string,
  workspaceId: unknown,
  args: { prompt?: string; source?: "ai" | "unsplash"; imageUrl?: string },
) {
  const deck = await requireDeck(deckId, workspaceId);
  const slide = (await Slide.findOne({
    _id: slideId,
    deckId,
    deletedAt: null,
  })) as unknown as AnyDoc | null;
  if (!slide) throw ApiError.notFound("Slide not found.");

  // A picked stock photo or any Unsplash photo is free; only AI generation costs.
  const cost = args.imageUrl || args.source === "unsplash" ? 0 : AI_IMAGE_COST;
  if (cost > 0) await recordCredit(workspaceId, -cost, "ai_image", slide._id);
  try {
    const resp = await fetch(`${env.AI_ENGINE_URL}/slide/image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slide: slide.content ?? { slideType: slide.layout, title: slide.title },
        prompt: args.prompt,
        source: args.source ?? "ai",
        imageUrl: args.imageUrl,
        ...deckRenderOpts(deck),
      }),
    });
    const body: any = await resp.json().catch(() => null);
    if (!resp.ok || !body?.html) {
      logger.error(
        { status: resp.status, engineError: body?.error, body },
        "ai-engine /slide/image failed",
      );
      throw ApiError.serviceUnavailable(
        body?.error
          ? `Image generation failed: ${body.error}`
          : "Image generation failed. Try again.",
      );
    }

    slide.content = body.slide ?? slide.content;
    slide.html = body.html;
    await slide.save();
    // Catalogue the resulting image. A chosen/stock URL is Unsplash; a prompt with
    // source "ai" is an AI illustration. (Deduped — re-applying a library image
    // won't create a copy.)
    const newImageUrl = body.imageUrl ?? body.slide?.imageUrl;
    if (newImageUrl) {
      captureAsset({
        workspaceId,
        url: newImageUrl,
        source: !args.imageUrl && args.source !== "unsplash" ? "ai" : "unsplash",
        deckId,
        slideId: slide._id,
        prompt: args.prompt,
      });
    }
    return slide;
  } catch (err) {
    if (cost > 0) await recordCredit(workspaceId, cost, "refund", slide._id);
    if (err instanceof ApiError) throw err;
    logger.error({ err, slideId }, "setSlideImage failed");
    throw ApiError.serviceUnavailable("Image generation failed. Try again.");
  }
}

/** Reorder a deck's slides to match the given slideId order. */
export async function reorderSlides(
  deckId: string,
  workspaceId: unknown,
  slideIds: string[],
) {
  const deck = (await requireDeck(deckId, workspaceId)) as unknown as AnyDoc;
  // One round-trip instead of N sequential updates.
  await Slide.bulkWrite(
    slideIds.map((sid, i) => ({
      updateOne: {
        filter: { _id: sid, deckId },
        update: { position: i, slideNumber: i + 1 },
      },
    })),
  );
  deck.slideOrder = slideIds;
  await deck.save();

  return Slide.find({ deckId, deletedAt: null }).sort({ position: 1 }).lean();
}

/**
 * Place `newId` into the deck's order — right after `afterSlideId`, or at the
 * end — then renumber every live slide's position. Persists deck.slideOrder.
 */
async function placeSlide(
  deck: AnyDoc,
  deckId: string,
  newId: unknown,
  afterSlideId?: string,
) {
  const live = await Slide.find({ deckId, deletedAt: null })
    .sort({ position: 1 })
    .lean();
  const order = live
    .map((s) => String((s as any)._id))
    .filter((sid) => sid !== String(newId));

  const at = afterSlideId ? order.indexOf(String(afterSlideId)) : -1;
  if (at >= 0) order.splice(at + 1, 0, String(newId));
  else order.push(String(newId));

  // One round-trip instead of N sequential updates.
  await Slide.bulkWrite(
    order.map((sid, i) => ({
      updateOne: {
        filter: { _id: sid, deckId },
        update: { position: i, slideNumber: i + 1 },
      },
    })),
  );
  deck.slideOrder = order;
  await deck.save();
}

/**
 * Add a slide, optionally inserted right after `afterSlideId`. With `content`
 * (e.g. a paste) the slide is built from it and re-rendered for this deck;
 * otherwise a blank slide for `layout` is created.
 */
export async function addSlide(
  deckId: string,
  workspaceId: unknown,
  opts: { layout?: string; afterSlideId?: string; content?: any } = {},
) {
  const deck = (await requireDeck(deckId, workspaceId)) as unknown as AnyDoc;
  const layout = opts.content?.recommendedLayout ?? opts.layout ?? "minimal";
  const content = opts.content ?? {
    title: "New slide",
    description: "",
    bulletPoints: [] as string[],
    slideType: "content",
    recommendedLayout: layout,
  };
  // Re-render from content (never trust client HTML) so it matches this deck.
  const html = await renderSlideContent(content, deckRenderOpts(deck));

  const slide = (await Slide.create({
    deckId,
    workspaceId,
    position: 0,
    slideNumber: 0,
    layout,
    title: content.title ?? "New slide",
    content,
    html,
    status: "ready",
  })) as unknown as AnyDoc;

  await placeSlide(deck, deckId, slide._id, opts.afterSlideId);

  // Image layouts (hero / image_left / image_right / quote_image) render an empty
  // panel without a picture. Auto-fill a FREE stock photo so a newly added image
  // slide never starts blank. Best-effort — the slide is added regardless.
  if (IMAGE_LAYOUTS.has(layout) && !content.imageUrl) {
    try {
      const prompt =
        content.visualRequirements?.searchQuery ||
        content.title ||
        deck.title ||
        "business";
      return await setSlideImage(deckId, String(slide._id), workspaceId, {
        prompt,
        source: "unsplash",
      });
    } catch (err) {
      logger.warn({ err, slideId: slide._id }, "auto-image for new slide failed");
    }
  }

  return Slide.findById(slide._id);
}

/** Duplicate a slide (content + html), inserted right after the original. */
export async function duplicateSlide(
  deckId: string,
  slideId: string,
  workspaceId: unknown,
) {
  const deck = (await requireDeck(deckId, workspaceId)) as unknown as AnyDoc;
  const src = (await Slide.findOne({
    _id: slideId,
    deckId,
    deletedAt: null,
  }).lean()) as any;
  if (!src) throw ApiError.notFound("Slide not found.");

  const copy = (await Slide.create({
    deckId,
    workspaceId,
    position: 0,
    slideNumber: 0,
    layout: src.layout,
    title: src.title,
    content: src.content,
    html: src.html,
    status: "ready",
  })) as unknown as AnyDoc;

  await placeSlide(deck, deckId, copy._id, slideId);
  return Slide.findById(copy._id);
}

/** Soft-delete a slide and drop it from the deck order. */
export async function deleteSlide(
  deckId: string,
  slideId: string,
  workspaceId: unknown,
) {
  await requireDeck(deckId, workspaceId);
  // Two direct writes instead of load-mutate-save round-trips.
  const res = await Slide.updateOne(
    { _id: slideId, deckId, deletedAt: null },
    { deletedAt: new Date() },
  );
  if (res.matchedCount === 0) throw ApiError.notFound("Slide not found.");
  await Deck.updateOne({ _id: deckId }, { $pull: { slideOrder: slideId } });
  return { ok: true };
}

/**
 * Restyle the whole deck: apply a new theme and/or accent, re-render every slide
 * via the engine, and persist the new deck theme + shared stylesheet. Returns the
 * updated deck + re-rendered slides so the editor can swap them in.
 */
export async function changeDeckTheme(
  deckId: string,
  workspaceId: unknown,
  patch: { theme?: string; accentColor?: string },
) {
  const deck = (await requireDeck(deckId, workspaceId)) as unknown as AnyDoc;
  if (patch.theme === undefined && patch.accentColor === undefined) {
    throw ApiError.badRequest("Provide a theme and/or accent colour.");
  }
  if (patch.theme !== undefined) deck.theme = patch.theme;
  if (patch.accentColor !== undefined) {
    deck.accentColor = { name: patch.accentColor };
  }

  const slides = await Slide.find({ deckId, deletedAt: null })
    .sort({ position: 1 })
    .lean();
  const opts = deckRenderOpts(deck);

  // Re-render each structured slide under the new theme. One call returns html +
  // the shared css; capture the css once for the deck-wide stylesheet.
  let styleCss: string | undefined;
  await Promise.all(
    slides.map(async (s: any) => {
      if (!s.content || typeof s.content !== "object") return;
      const result = await renderSlideContentWithCss(s.content, opts);
      styleCss = result.css;
      await Slide.updateOne({ _id: s._id }, { html: result.html });
    }),
  );
  if (styleCss) deck.styleCss = styleCss;
  await deck.save();

  const updated = await Slide.find({ deckId, deletedAt: null })
    .sort({ position: 1 })
    .lean();
  return { deck, slides: updated };
}

/**
 * Decorate lean deck docs with: a slide-1 thumbnail HTML, the creator's name/avatar,
 * and the current user's view-state (lastViewedAt, favorite). One batched query each.
 */
async function decorateDecks(decks: any[], userId: string) {
  if (decks.length === 0) return decks;
  const deckIds = decks.map((d) => d._id);

  const [firsts, views, authors] = await Promise.all([
    Slide.aggregate([
      { $match: { deckId: { $in: deckIds }, deletedAt: null } },
      { $sort: { position: 1 } },
      { $group: { _id: "$deckId", html: { $first: "$html" } } },
    ]),
    DeckView.find({ deckId: { $in: deckIds }, userId }).lean(),
    User.find({ _id: { $in: decks.map((d) => d.authorId).filter(Boolean) } })
      .select("userName avatar")
      .lean(),
  ]);

  const htmlByDeck = new Map(firsts.map((f: any) => [String(f._id), f.html]));
  const viewByDeck = new Map(views.map((v: any) => [String(v.deckId), v]));
  const authorById = new Map(authors.map((a: any) => [String(a._id), a]));

  return decks.map((d) => {
    const view: any = viewByDeck.get(String(d._id));
    const author: any = authorById.get(String(d.authorId));
    return {
      ...d,
      thumbnailHtml: htmlByDeck.get(String(d._id)) ?? null,
      lastViewedAt: view?.lastViewedAt ?? null,
      favorite: Boolean(view?.favorite),
      creator: author
        ? { name: author.userName, avatar: author.avatar ?? "" }
        : null,
    };
  });
}

export type DeckFilter = "all" | "recent" | "created" | "favorites";
export type DeckSort = "updated" | "created" | "title" | "viewed";

/**
 * A workspace's decks for the dashboard — filtered (all/recent/created/favorites),
 * sorted, paginated, and decorated with thumbnail + creator + the user's view-state.
 */
export async function listWorkspaceDecks(
  workspaceId: unknown,
  userId: string,
  opts: {
    page?: number;
    limit?: number;
    filter?: DeckFilter;
    sort?: DeckSort;
    desc?: boolean;
    folderId?: string;
    source?: "app" | "api";
  } = {},
) {
  const limit = Math.min(
    Math.max(opts.limit ?? DECK_PAGE_SIZE, 1),
    DECK_PAGE_SIZE_MAX,
  );
  const page = Math.max(opts.page ?? 1, 1);
  const filter = opts.filter ?? "all";
  const dir = opts.desc === false ? 1 : -1;

  const query: Record<string, unknown> = { workspaceId, deletedAt: null };
  if (filter === "created") query.authorId = userId;
  if (opts.folderId) query.folderId = opts.folderId;
  // "app" = everything NOT created via the API — includes legacy decks that
  // predate the `source` field (where it's missing, not "app"). "api" = exactly api.
  if (opts.source === "api") query.source = "api";
  else if (opts.source === "app") query.source = { $ne: "api" };

  // Recent / favorites are driven by the user's DeckView rows.
  if (filter === "recent" || filter === "favorites") {
    const vq: Record<string, unknown> = { workspaceId, userId };
    if (filter === "favorites") vq.favorite = true;
    else vq.viewCount = { $gt: 0 };
    const views = await DeckView.find(vq)
      .sort({ lastViewedAt: -1 })
      .select("deckId lastViewedAt")
      .lean();
    const order = views.map((v: any) => String(v.deckId));
    query._id = { $in: views.map((v: any) => v.deckId) };
    const total = order.length;
    const pageIds = order.slice((page - 1) * limit, page * limit);
    const docs = await Deck.find({
      ...query,
      _id: { $in: pageIds },
    }).lean();
    // Preserve the recency order from the views query.
    const byId = new Map(docs.map((d: any) => [String(d._id), d]));
    const ordered = pageIds.map((id) => byId.get(id)).filter(Boolean) as any[];
    const decks = await decorateDecks(ordered, userId);
    return { decks, total, page, limit, hasMore: page * limit < total };
  }

  const sortKey =
    opts.sort === "title" ? "title" : opts.sort === "created" ? "createdAt" : "updatedAt";
  const sortField: Record<string, 1 | -1> = { [sortKey]: dir as 1 | -1 };

  const [docs, total] = await Promise.all([
    Deck.find(query)
      .sort(sortField)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Deck.countDocuments(query),
  ]);
  const decks = await decorateDecks(docs, userId);
  return { decks, total, page, limit, hasMore: page * limit < total };
}

/**
 * Search a workspace's decks by title AND slide content/notes (server-side). Returns
 * a small, decorated result set for the ⌘K command palette. Case-insensitive.
 */
export async function searchDecks(
  workspaceId: unknown,
  userId: string,
  q: string,
  limit = 12,
) {
  const term = q.trim();
  if (!term) return [];
  const rx = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

  // Decks whose title matches, plus decks that have a slide matching by
  // title/notes/text content — unioned.
  const [byTitle, contentSlides] = await Promise.all([
    Deck.find({ workspaceId, deletedAt: null, title: rx })
      .select("_id")
      .limit(50)
      .lean(),
    Slide.find({
      workspaceId,
      deletedAt: null,
      $or: [{ title: rx }, { notes: rx }, { "content.title": rx }, { "content.description": rx }],
    })
      .select("deckId")
      .limit(200)
      .lean(),
  ]);

  const ids = new Set<string>();
  byTitle.forEach((d: any) => ids.add(String(d._id)));
  contentSlides.forEach((s: any) => ids.add(String(s.deckId)));
  if (ids.size === 0) return [];

  const docs = await Deck.find({
    _id: { $in: [...ids] },
    workspaceId,
    deletedAt: null,
  })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();
  return decorateDecks(docs, userId);
}

// ── Trash (soft delete → restore → permanent purge) ──────────────────────────

/** Move a deck to trash (soft delete — recoverable). */
export async function trashDeck(deckId: string, workspaceId: unknown) {
  const res = await Deck.updateOne(
    { _id: deckId, workspaceId, deletedAt: null },
    { deletedAt: new Date() },
  );
  if (res.matchedCount === 0) throw ApiError.notFound("Deck not found.");
  return { ok: true };
}

/** Restore a trashed deck back to the workspace. */
export async function restoreDeck(deckId: string, workspaceId: unknown) {
  const res = await Deck.updateOne(
    { _id: deckId, workspaceId, deletedAt: { $ne: null } },
    { deletedAt: null },
  );
  if (res.matchedCount === 0) throw ApiError.notFound("Deck not in trash.");
  return { ok: true };
}

/**
 * Permanently delete a deck and its slides (+ view/share records). Irreversible.
 * Only allowed from trash (deck must already be soft-deleted) as a safety guard.
 */
export async function purgeDeck(deckId: string, workspaceId: unknown) {
  const deck = await Deck.findOne({
    _id: deckId,
    workspaceId,
    deletedAt: { $ne: null },
  });
  if (!deck) throw ApiError.notFound("Deck not in trash.");
  await Promise.all([
    Slide.deleteMany({ deckId }),
    DeckView.deleteMany({ deckId }),
  ]);
  await Deck.deleteOne({ _id: deckId, workspaceId });
  return { ok: true };
}

/** Trashed decks for the workspace, most-recently-deleted first. */
export async function listTrashedDecks(workspaceId: unknown, userId: string) {
  const docs = await Deck.find({ workspaceId, deletedAt: { $ne: null } })
    .sort({ deletedAt: -1 })
    .lean();
  return decorateDecks(docs, userId);
}

/** Permanently delete EVERY trashed deck in the workspace (irreversible). */
export async function emptyTrash(workspaceId: unknown) {
  const trashed = await Deck.find({ workspaceId, deletedAt: { $ne: null } })
    .select("_id")
    .lean();
  const ids = trashed.map((d: any) => d._id);
  if (ids.length === 0) return { ok: true, deleted: 0 };
  await Promise.all([
    Slide.deleteMany({ deckId: { $in: ids } }),
    DeckView.deleteMany({ deckId: { $in: ids } }),
  ]);
  await Deck.deleteMany({ _id: { $in: ids }, workspaceId });
  return { ok: true, deleted: ids.length };
}
