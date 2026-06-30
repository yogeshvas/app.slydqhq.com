import type { Request, Response } from "express";
import asyncHandler from "../middleware/asyncHandler";
import ApiResponse from "../responses/apiResponse";
import { DEFAULT_SLIDES } from "../config/constants";
import { getCurrentWorkspace } from "../services/workspace.service";
import {
  createGenerationJob,
  getLatestOutline,
  requestOutline,
  requestOutlineCard,
  runGeneration,
  updateOutline,
  type DeckOutline,
} from "../services/generation.service";
import {
  addSlide,
  aiEditSlide,
  changeDeckTheme,
  deleteSlide,
  duplicateSlide,
  getDeckWithSlides,
  listWorkspaceDecks,
  emptyTrash,
  listTrashedDecks,
  purgeDeck,
  reorderSlides,
  restoreDeck,
  searchDecks,
  searchStockImages,
  setSlideImage,
  trashDeck,
  updateDeckMeta,
  updateSlide,
  type DeckFilter,
  type DeckSort,
} from "../services/deck.service";
import { exportDeck, listDeckExports } from "../services/export.service";
import {
  getOrCreateShare,
  updateShareSettings,
} from "../services/share.service";
import {
  getDeckViewers,
  recordDeckView,
  setFavorite,
} from "../services/view.service";
import { moveDeckToFolder } from "../services/folder.service";
import type { ExportFormat } from "../config/constants";

interface GenerateBody {
  prompt: string;
  noOfSlides?: number;
  deckType?: string;
  theme?: string;
  canvas?: string;
  accentColor?: string;
  model?: string;
  outline?: DeckOutline;
}

/**
 * POST /decks/outline — generate an editable outline (titles + bullets) for the
 * given prompt/config. No deck is created and no credits are charged yet; the
 * outline is persisted so the review page can show it again without re-running
 * the model.
 */
export const generateDeckOutline = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.auth!.id;
    const workspace = await getCurrentWorkspace(userId);
    const body = req.body as GenerateBody;
    const outline = await requestOutline({
      workspaceId: workspace.id,
      userId,
      prompt: body.prompt,
      noOfSlides: body.noOfSlides ?? DEFAULT_SLIDES,
      deckType: body.deckType,
      theme: body.theme,
      canvas: body.canvas,
      accentColor: body.accentColor,
      model: body.model,
    });
    return ApiResponse.success(res, outline, "Outline ready.");
  },
);

/**
 * GET /decks/outline/latest — the workspace's most recent saved outline (with the
 * config it was generated with), or null. Lets the review page restore the last
 * outline without spending tokens to regenerate it.
 */
export const getLatestDeckOutline = asyncHandler(
  async (req: Request, res: Response) => {
    const workspace = await getCurrentWorkspace(req.auth!.id);
    const outline = await getLatestOutline(workspace.id);
    return ApiResponse.success(res, { outline }, "Latest outline.");
  },
);

/**
 * POST /decks/outline/slide — generate a single outline card (title + bullets)
 * that fits the current deck. No deck/credits involved.
 */
export const generateOutlineCard = asyncHandler(
  async (req: Request, res: Response) => {
    const body = req.body as {
      prompt: string;
      deckTitle?: string;
      storyTheme?: string;
      deckType?: string;
      existingTitles?: string[];
      position?: number;
      hint?: string;
    };
    const card = await requestOutlineCard(body);
    return ApiResponse.success(res, card, "Card generated.");
  },
);

/**
 * PATCH /decks/outline/:id — persist edits made to a saved outline (title/slides)
 * so they survive reloads and other sessions.
 */
export const updateDeckOutline = asyncHandler(
  async (req: Request, res: Response) => {
    const workspace = await getCurrentWorkspace(req.auth!.id);
    const { id } = req.params as { id: string };
    const body = req.body as {
      deckTitle?: string;
      storyTheme?: string;
      slides?: DeckOutline["slides"];
    };
    const outline = await updateOutline(id, workspace.id, body);
    return ApiResponse.success(res, outline, "Outline saved.");
  },
);

/**
 * POST /decks/generate — create a deck and stream its generation over SSE.
 * Credit charge + job creation happen before the SSE handshake, so an
 * insufficient-credits error returns as normal JSON.
 */
export const generateDeck = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.auth!.id;
    const workspace = await getCurrentWorkspace(userId);
    const body = req.body as GenerateBody;
    const noOfSlides = body.noOfSlides ?? DEFAULT_SLIDES;

    const { deck, job } = await createGenerationJob({
      workspaceId: workspace.id,
      userId,
      prompt: body.prompt,
      noOfSlides,
      deckType: body.deckType,
      theme: body.theme,
      canvas: body.canvas,
      accentColor: body.accentColor,
      outline: body.outline,
    });

    // ── SSE handshake ──
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // disable proxy buffering
    res.flushHeaders?.();

    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Keep idle proxies from dropping the long-lived connection.
    const heartbeat = setInterval(() => res.write(`: ping\n\n`), 15000);
    let clientGone = false;
    res.on("close", () => {
      if (!res.writableFinished) clientGone = true;
    });

    // Hand the client its ids up front so it can poll/reconnect if needed.
    send("created", { deckId: deck._id, jobId: job._id });

    await runGeneration(deck, job, { send, isClientGone: () => clientGone });

    clearInterval(heartbeat);
    res.end();
  },
);

/** GET /decks — the workspace's decks (filtered/sorted/paginated) for the dashboard. */
export const listDecks = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.auth!.id;
  const workspace = await getCurrentWorkspace(userId);
  const { page, limit, filter, sort, desc, folderId, source } = req.query as {
    page?: string;
    limit?: string;
    filter?: DeckFilter;
    sort?: DeckSort;
    desc?: string;
    folderId?: string;
    source?: "app" | "api";
  };
  const result = await listWorkspaceDecks(workspace.id, userId, {
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    filter,
    sort,
    desc: desc === undefined ? undefined : desc === "true",
    folderId,
    source,
  });
  return ApiResponse.success(res, result, "Decks loaded.");
});

/** GET /decks/search?q= — title + content search for the command palette. */
export const searchDecksController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.auth!.id;
    const workspace = await getCurrentWorkspace(userId);
    const { q } = req.query as { q?: string };
    const decks = await searchDecks(workspace.id, userId, q ?? "");
    return ApiResponse.success(res, { decks }, "Search results.");
  },
);

/** GET /decks/:id — a deck with its slides in render order (records a view). */
export const getDeck = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.auth!.id;
  const workspace = await getCurrentWorkspace(userId);
  const data = await getDeckWithSlides(req.params.id as string, workspace.id, userId);
  // Record this open for "Recently viewed" + who-viewed analytics (best-effort).
  void recordDeckView(req.params.id, userId, workspace.id);
  return ApiResponse.success(res, data, "Deck loaded.");
});

/** POST /decks/:id/favorite — star/unstar the deck for the current user. */
export const toggleFavorite = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.auth!.id;
    const workspace = await getCurrentWorkspace(userId);
    const { favorite } = req.body as { favorite: boolean };
    const result = await setFavorite(
      req.params.id as string,
      userId,
      workspace.id,
      favorite,
    );
    return ApiResponse.success(res, result, "Favorite updated.");
  },
);

/** GET /decks/:id/viewers — who viewed this deck (members) + anonymous count. */
export const getViewers = asyncHandler(async (req: Request, res: Response) => {
  const workspace = await getCurrentWorkspace(req.auth!.id);
  const data = await getDeckViewers(req.params.id as string, workspace.id);
  return ApiResponse.success(res, data, "Viewers loaded.");
});

/** GET /decks/trash — the workspace's trashed decks. */
export const getTrash = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.auth!.id;
  const workspace = await getCurrentWorkspace(userId);
  const decks = await listTrashedDecks(workspace.id, userId);
  return ApiResponse.success(res, { decks }, "Trash loaded.");
});

/** DELETE /decks/trash — permanently delete ALL trashed decks (irreversible). */
export const emptyTrashController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspace = await getCurrentWorkspace(req.auth!.id);
    const result = await emptyTrash(workspace.id);
    return ApiResponse.success(res, result, "Trash emptied.");
  },
);

/** POST /decks/:id/trash — move a deck to trash (soft delete). */
export const moveDeckToTrash = asyncHandler(
  async (req: Request, res: Response) => {
    const workspace = await getCurrentWorkspace(req.auth!.id);
    await trashDeck(req.params.id as string, workspace.id);
    return ApiResponse.success(res, { ok: true }, "Moved to trash.");
  },
);

/** POST /decks/:id/restore — restore a trashed deck. */
export const restoreDeckController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspace = await getCurrentWorkspace(req.auth!.id);
    await restoreDeck(req.params.id as string, workspace.id);
    return ApiResponse.success(res, { ok: true }, "Deck restored.");
  },
);

/** DELETE /decks/:id — permanently delete a trashed deck (irreversible). */
export const purgeDeckController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspace = await getCurrentWorkspace(req.auth!.id);
    await purgeDeck(req.params.id as string, workspace.id);
    return ApiResponse.success(res, { ok: true }, "Deck permanently deleted.");
  },
);

/** POST /decks/:id/move — file a deck into a folder (or null to unfile). */
export const moveDeck = asyncHandler(async (req: Request, res: Response) => {
  const workspace = await getCurrentWorkspace(req.auth!.id);
  const { folderId } = req.body as { folderId: string | null };
  const result = await moveDeckToFolder(
    req.params.id as string,
    workspace.id,
    folderId,
  );
  return ApiResponse.success(res, result, "Deck moved.");
});

/** PATCH /decks/:id — save deck metadata (e.g. the title). */
export const updateDeck = asyncHandler(async (req: Request, res: Response) => {
  const workspace = await getCurrentWorkspace(req.auth!.id);
  const { title } = req.body as { title?: string };
  const deck = await updateDeckMeta(req.params.id as string, workspace.id, {
    title,
  });
  return ApiResponse.success(res, { deck }, "Deck updated.");
});

/** PATCH /decks/:id/slides/:slideId — save inline (html) or structured (content) edits. */
export const updateSlideContent = asyncHandler(
  async (req: Request, res: Response) => {
    const workspace = await getCurrentWorkspace(req.auth!.id);
    const { id, slideId } = req.params as { id: string; slideId: string };
    const { html, title, content, notes } = req.body as {
      html?: string;
      title?: string;
      content?: unknown;
      notes?: string;
    };
    const slide = await updateSlide(id, slideId, workspace.id, {
      html,
      title,
      content,
      notes,
    });
    return ApiResponse.success(res, { slide }, "Slide updated.");
  },
);

/** PATCH /decks/:id/reorder — set the slide order. */
export const reorderDeckSlides = asyncHandler(
  async (req: Request, res: Response) => {
    const workspace = await getCurrentWorkspace(req.auth!.id);
    const { slideIds } = req.body as { slideIds: string[] };
    const slides = await reorderSlides(
      req.params.id as string,
      workspace.id,
      slideIds,
    );
    return ApiResponse.success(res, { slides }, "Slides reordered.");
  },
);

/** POST /decks/:id/slides — add a blank slide (optionally after a given slide). */
export const addDeckSlide = asyncHandler(
  async (req: Request, res: Response) => {
    const workspace = await getCurrentWorkspace(req.auth!.id);
    const { layout, afterSlideId, content } = req.body as {
      layout?: string;
      afterSlideId?: string;
      content?: unknown;
    };
    const slide = await addSlide(req.params.id as string, workspace.id, {
      layout,
      afterSlideId,
      content,
    });
    return ApiResponse.created(res, { slide }, "Slide added.");
  },
);

/** POST /decks/:id/slides/:slideId/duplicate — duplicate a slide after itself. */
export const duplicateDeckSlide = asyncHandler(
  async (req: Request, res: Response) => {
    const workspace = await getCurrentWorkspace(req.auth!.id);
    const { id, slideId } = req.params as { id: string; slideId: string };
    const slide = await duplicateSlide(id, slideId, workspace.id);
    return ApiResponse.created(res, { slide }, "Slide duplicated.");
  },
);

/** POST /decks/:id/slides/:slideId/ai-edit — AI revise content / change layout. */
export const aiEditDeckSlide = asyncHandler(
  async (req: Request, res: Response) => {
    const workspace = await getCurrentWorkspace(req.auth!.id);
    const { id, slideId } = req.params as { id: string; slideId: string };
    const { instruction, layout } = req.body as {
      instruction?: string;
      layout?: string;
    };
    const slide = await aiEditSlide(id, slideId, workspace.id, {
      instruction,
      layout,
    });
    return ApiResponse.success(res, { slide }, "Slide updated by AI.");
  },
);

/** POST /decks/:id/slides/:slideId/image — set the image from a prompt or a picked URL. */
export const regenerateSlideImage = asyncHandler(
  async (req: Request, res: Response) => {
    const workspace = await getCurrentWorkspace(req.auth!.id);
    const { id, slideId } = req.params as { id: string; slideId: string };
    const { prompt, source, imageUrl } = req.body as {
      prompt?: string;
      source?: "ai" | "unsplash";
      imageUrl?: string;
    };
    const slide = await setSlideImage(id, slideId, workspace.id, {
      prompt,
      source,
      imageUrl,
    });
    return ApiResponse.success(res, { slide }, "Image updated.");
  },
);

/** POST /decks/stock-search — stock photo options for the editor's picker. */
export const searchStockPhotos = asyncHandler(
  async (req: Request, res: Response) => {
    const { query, orientation } = req.body as {
      query: string;
      orientation?: "landscape" | "portrait" | "square";
    };
    const images = await searchStockImages(query, orientation);
    return ApiResponse.success(res, { images }, "Stock photos.");
  },
);

/** POST /decks/:id/export — export the deck (optionally a card range) → { url }. */
export const exportDeckFile = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.auth!.id;
    const workspace = await getCurrentWorkspace(userId);
    const { format, slideNumbers } = req.body as {
      format: ExportFormat;
      slideNumbers?: number[];
    };
    const result = await exportDeck(
      req.params.id as string,
      workspace.id,
      userId,
      format,
      slideNumbers,
    );
    return ApiResponse.success(res, result, "Export ready.");
  },
);

/** GET /decks/:id/exports — the deck's export history. */
export const getDeckExports = asyncHandler(
  async (req: Request, res: Response) => {
    const workspace = await getCurrentWorkspace(req.auth!.id);
    const exports = await listDeckExports(req.params.id as string, workspace.id);
    return ApiResponse.success(res, { exports }, "Exports loaded.");
  },
);

/** GET /decks/:id/share — the public-link settings (creates the link lazily). */
export const getDeckShare = asyncHandler(async (req: Request, res: Response) => {
  const workspace = await getCurrentWorkspace(req.auth!.id);
  const share = await getOrCreateShare(req.params.id as string, workspace.id);
  return ApiResponse.success(res, { share }, "Share link ready.");
});

/** PUT /decks/:id/share — update public-link settings (password/download/etc). */
export const updateDeckShare = asyncHandler(
  async (req: Request, res: Response) => {
    const workspace = await getCurrentWorkspace(req.auth!.id);
    const { enabled, allowDownload, discoverable, password } = req.body as {
      enabled?: boolean;
      allowDownload?: boolean;
      discoverable?: boolean;
      password?: string | null;
    };
    const share = await updateShareSettings(
      req.params.id as string,
      workspace.id,
      { enabled, allowDownload, discoverable, password },
    );
    return ApiResponse.success(res, { share }, "Share settings saved.");
  },
);

/** PATCH /decks/:id/theme — restyle the whole deck (theme + accent). */
export const changeTheme = asyncHandler(async (req: Request, res: Response) => {
  const workspace = await getCurrentWorkspace(req.auth!.id);
  const { theme, accentColor } = req.body as {
    theme?: string;
    accentColor?: string;
  };
  const data = await changeDeckTheme(req.params.id as string, workspace.id, {
    theme,
    accentColor,
  });
  return ApiResponse.success(res, data, "Theme updated.");
});

/** DELETE /decks/:id/slides/:slideId — remove a slide. */
export const deleteDeckSlide = asyncHandler(
  async (req: Request, res: Response) => {
    const workspace = await getCurrentWorkspace(req.auth!.id);
    const { id, slideId } = req.params as { id: string; slideId: string };
    await deleteSlide(id, slideId, workspace.id);
    return ApiResponse.success(res, { ok: true }, "Slide deleted.");
  },
);
