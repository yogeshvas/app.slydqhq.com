import { apiClient } from "@/lib/api-client";
import { env } from "@/config/env";
import { tokenStorage } from "@/lib/token-storage";
import type { ApiSuccess } from "@/types/api";
import type {
  Deck,
  DeckExport,
  DeckFilter,
  DeckListResult,
  DeckOutline,
  DeckSortKey,
  DeckSummary,
  DeckViewer,
  ExportFormat,
  GenerateParams,
  LatestOutline,
  OutlineEvent,
  OutlineParams,
  OutlineSlide,
  ShareSettings,
  Slide,
  SlideContent,
  SlideEvent,
} from "../types/deck.types";

export const decksApi = {
  /** GET /decks — the workspace's decks (filtered/sorted/paginated). */
  list: (
    params: {
      page?: number;
      limit?: number;
      filter?: DeckFilter;
      sort?: DeckSortKey;
      desc?: boolean;
      folderId?: string;
    } = {},
  ) =>
    apiClient
      .get<ApiSuccess<DeckListResult>>("/decks", { params })
      .then((res) => res.data.data),

  /** GET /decks/search?q= — title + content search (command palette). */
  search: (q: string) =>
    apiClient
      .get<ApiSuccess<{ decks: DeckSummary[] }>>("/decks/search", {
        params: { q },
      })
      .then((res) => res.data.data.decks),

  /** GET /decks/trash — the workspace's trashed decks. */
  trashList: () =>
    apiClient
      .get<ApiSuccess<{ decks: DeckSummary[] }>>("/decks/trash")
      .then((res) => res.data.data.decks),

  /** POST /decks/:id/trash — move a deck to trash (soft delete). */
  trash: (deckId: string) =>
    apiClient
      .post<ApiSuccess<{ ok: boolean }>>(`/decks/${deckId}/trash`)
      .then((res) => res.data.data),

  /** POST /decks/:id/restore — restore from trash. */
  restore: (deckId: string) =>
    apiClient
      .post<ApiSuccess<{ ok: boolean }>>(`/decks/${deckId}/restore`)
      .then((res) => res.data.data),

  /** DELETE /decks/:id — permanently delete a trashed deck. */
  purge: (deckId: string) =>
    apiClient
      .delete<ApiSuccess<{ ok: boolean }>>(`/decks/${deckId}`)
      .then((res) => res.data.data),

  /** DELETE /decks/trash — permanently delete ALL trashed decks. */
  emptyTrash: () =>
    apiClient
      .delete<ApiSuccess<{ ok: boolean; deleted: number }>>("/decks/trash")
      .then((res) => res.data.data),

  /** POST /decks/:id/favorite — star/unstar for the current user. */
  favorite: (deckId: string, favorite: boolean) =>
    apiClient
      .post<ApiSuccess<{ favorite: boolean }>>(`/decks/${deckId}/favorite`, {
        favorite,
      })
      .then((res) => res.data.data.favorite),

  /** GET /decks/:id/viewers — audience analytics. */
  viewers: (deckId: string) =>
    apiClient
      .get<ApiSuccess<{ anonymousViews: number; viewers: DeckViewer[] }>>(
        `/decks/${deckId}/viewers`,
      )
      .then((res) => res.data.data),

  /** GET /decks/:id — a deck with its slides in render order. */
  get: (id: string) =>
    apiClient
      .get<ApiSuccess<{ deck: Deck; slides: Slide[] }>>(`/decks/${id}`)
      .then((res) => res.data.data),

  /** POST /decks/outline — editable outline (titles + bullets), no deck created. */
  outline: (params: OutlineParams) =>
    apiClient
      .post<ApiSuccess<DeckOutline>>("/decks/outline", params)
      .then((res) => res.data.data),

  /** GET /decks/outline/latest — the workspace's last saved outline, or null. */
  latestOutline: () =>
    apiClient
      .get<ApiSuccess<{ outline: LatestOutline | null }>>("/decks/outline/latest")
      .then((res) => res.data.data.outline),

  /** POST /decks/outline/slide — AI-generate one card (title + bullets) for the deck. */
  outlineCard: (body: {
    prompt: string;
    deckTitle?: string;
    storyTheme?: string;
    deckType?: string;
    existingTitles?: string[];
    position?: number;
    hint?: string;
  }) =>
    apiClient
      .post<ApiSuccess<{ title: string; bullets: string[] }>>(
        "/decks/outline/slide",
        body,
      )
      .then((res) => res.data.data),

  /** PATCH /decks/outline/:id — persist edits to a saved outline. */
  updateOutline: (
    id: string,
    body: { deckTitle?: string; storyTheme?: string; slides?: OutlineSlide[] },
  ) =>
    apiClient
      .patch<ApiSuccess<DeckOutline>>(`/decks/outline/${id}`, body)
      .then((res) => res.data.data),

  /** PATCH /decks/:id/slides/:slideId — save raw (html), structured (content), or notes. */
  updateSlide: (
    deckId: string,
    slideId: string,
    patch: { html?: string; title?: string; content?: SlideContent; notes?: string },
  ) =>
    apiClient
      .patch<ApiSuccess<{ slide: Slide }>>(
        `/decks/${deckId}/slides/${slideId}`,
        patch,
      )
      .then((res) => res.data.data.slide),

  /** POST /decks/:id/export — export to PDF/PPTX/PNG (optional card range) → { url }. */
  exportDeck: (deckId: string, format: ExportFormat, slideNumbers?: number[]) =>
    apiClient
      .post<ApiSuccess<{ exportId: string; format: ExportFormat; url: string }>>(
        `/decks/${deckId}/export`,
        { format, slideNumbers },
      )
      .then((res) => res.data.data),

  /** GET /decks/:id/share — the public-link settings (creates the link lazily). */
  getShare: (deckId: string) =>
    apiClient
      .get<ApiSuccess<{ share: ShareSettings }>>(`/decks/${deckId}/share`)
      .then((res) => res.data.data.share),

  /** PUT /decks/:id/share — update public-link settings. */
  updateShare: (
    deckId: string,
    patch: {
      enabled?: boolean;
      allowDownload?: boolean;
      discoverable?: boolean;
      password?: string | null;
    },
  ) =>
    apiClient
      .put<ApiSuccess<{ share: ShareSettings }>>(`/decks/${deckId}/share`, patch)
      .then((res) => res.data.data.share),

  /** GET /decks/:id/exports — export history. */
  exports: (deckId: string) =>
    apiClient
      .get<ApiSuccess<{ exports: DeckExport[] }>>(`/decks/${deckId}/exports`)
      .then((res) => res.data.data.exports),

  /** PATCH /decks/:id/theme — restyle the whole deck → updated deck + slides. */
  changeTheme: (
    deckId: string,
    patch: { theme?: string; accentColor?: string },
  ) =>
    apiClient
      .patch<ApiSuccess<{ deck: Deck; slides: Slide[] }>>(
        `/decks/${deckId}/theme`,
        patch,
      )
      .then((res) => res.data.data),

  /** PATCH /decks/:id — save deck metadata (e.g. the title). */
  updateDeck: (deckId: string, patch: { title?: string }) =>
    apiClient
      .patch<ApiSuccess<{ deck: Deck }>>(`/decks/${deckId}`, patch)
      .then((res) => res.data.data.deck),

  /** PATCH /decks/:id/reorder — set the slide order. */
  reorderSlides: (deckId: string, slideIds: string[]) =>
    apiClient
      .patch<ApiSuccess<{ slides: Slide[] }>>(`/decks/${deckId}/reorder`, {
        slideIds,
      })
      .then((res) => res.data.data.slides),

  /** POST /decks/:id/slides — add a slide (blank, after a slide, or from content/paste). */
  addSlide: (
    deckId: string,
    body: {
      layout?: string;
      afterSlideId?: string;
      content?: SlideContent;
    } = {},
  ) =>
    apiClient
      .post<ApiSuccess<{ slide: Slide }>>(`/decks/${deckId}/slides`, body)
      .then((res) => res.data.data.slide),

  /** POST /decks/:id/slides/:slideId/duplicate — duplicate a slide after itself. */
  duplicateSlide: (deckId: string, slideId: string) =>
    apiClient
      .post<ApiSuccess<{ slide: Slide }>>(
        `/decks/${deckId}/slides/${slideId}/duplicate`,
      )
      .then((res) => res.data.data.slide),

  /** DELETE /decks/:id/slides/:slideId — remove a slide. */
  deleteSlide: (deckId: string, slideId: string) =>
    apiClient
      .delete<ApiSuccess<{ ok: boolean }>>(
        `/decks/${deckId}/slides/${slideId}`,
      )
      .then((res) => res.data.data),

  /** POST /decks/:id/slides/:slideId/ai-edit — AI revise content / change layout. */
  aiEditSlide: (
    deckId: string,
    slideId: string,
    body: { instruction?: string; layout?: string },
  ) =>
    apiClient
      .post<ApiSuccess<{ slide: Slide }>>(
        `/decks/${deckId}/slides/${slideId}/ai-edit`,
        body,
      )
      .then((res) => res.data.data.slide),

  /** POST /decks/:id/slides/:slideId/image — set image from a prompt or a picked URL. */
  regenerateImage: (
    deckId: string,
    slideId: string,
    body: { prompt?: string; source?: "ai" | "unsplash"; imageUrl?: string },
  ) =>
    apiClient
      .post<ApiSuccess<{ slide: Slide }>>(
        `/decks/${deckId}/slides/${slideId}/image`,
        body,
      )
      .then((res) => res.data.data.slide),

  /** POST /decks/stock-search — stock photo options for the picker. */
  stockSearch: (query: string, orientation?: "landscape" | "portrait" | "square") =>
    apiClient
      .post<ApiSuccess<{ images: string[] }>>("/decks/stock-search", {
        query,
        orientation,
      })
      .then((res) => res.data.data.images),
};

export interface GenerateHandlers {
  onCreated?: (d: { deckId: string; jobId: string }) => void;
  onOutline?: (d: OutlineEvent) => void;
  onSlide?: (d: SlideEvent) => void;
  onSlideError?: (d: { slideNumber: number; error: string }) => void;
  onDone?: (d: { deckId: string; slideCount: number }) => void;
  onError?: (message: string) => void;
}

/** Dispatch one parsed SSE frame to the matching handler. */
function dispatch(frame: string, handlers: GenerateHandlers) {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith(":")) continue; // heartbeat comment
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  const raw = dataLines.join("\n");
  let data: any = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    return;
  }

  switch (event) {
    case "created":
      return handlers.onCreated?.(data);
    case "outline":
      return handlers.onOutline?.(data);
    case "slide":
      return handlers.onSlide?.(data);
    case "slide_error":
      return handlers.onSlideError?.(data);
    case "done":
      return handlers.onDone?.(data);
    case "error":
      return handlers.onError?.(data.error ?? "Generation failed.");
    default:
      return undefined;
  }
}

/**
 * Stream a deck generation over SSE. Uses fetch (not EventSource) so we can POST
 * a body and send the bearer token. Resolves when the stream ends.
 */
export async function streamDeckGeneration(
  params: GenerateParams,
  handlers: GenerateHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const token = tokenStorage.get();
  const resp = await fetch(`${env.apiBaseUrl}/decks/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(params),
    signal,
  });

  // Pre-stream failures (validation, insufficient credits) come back as JSON.
  if (!resp.ok || !resp.body) {
    let message = "Generation failed. Please try again.";
    try {
      const body = await resp.json();
      message = body.message ?? message;
    } catch {
      /* keep default */
    }
    handlers.onError?.(message);
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      if (frame.trim()) dispatch(frame, handlers);
    }
  }
}
