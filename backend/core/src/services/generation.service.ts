import { Deck } from "../models/content/deck.model";
import { Slide } from "../models/content/slide.model";
import { Outline } from "../models/content/outline.model";
import { Job } from "../models/generation/job.model";
import { env } from "../config/env";
import { deckGenerationCost } from "../config/pricing";
import ApiError from "../utils/appError";
import { logger } from "../utils/logger";
import { recordCredit } from "./credit.service";
import { captureAsset } from "./media.service";
import { queueDeckThumbnail } from "./thumbnail.service";

export interface OutlineSlide {
  slideNumber: number;
  title: string;
  bullets: string[];
  /** Semantic role from the outline agent — threaded to the engine for layout choice. */
  slideType?: string;
}
export interface DeckOutline {
  deckTitle: string;
  storyTheme: string;
  analysis?: Record<string, unknown>;
  slides: OutlineSlide[];
  /** Set when the outline has been persisted (returned to the client). */
  outlineId?: string;
}

export interface GenerateParams {
  workspaceId: unknown;
  userId: string;
  prompt: string;
  noOfSlides: number;
  deckType?: string;
  theme?: string;
  canvas?: string;
  accentColor?: string;
  /** Approved outline (titles + bullets) to build the deck from, if any. */
  outline?: DeckOutline;
}

/**
 * Ask the ai-engine for an editable outline (titles + bullets) before any deck
 * is created or credits charged. The outline is persisted for the workspace so
 * the review page can show it again without re-calling the model (saving tokens),
 * then returned to the client for review/edit.
 */
export async function requestOutline(params: {
  workspaceId: unknown;
  userId: string;
  prompt: string;
  noOfSlides: number;
  deckType?: string;
  theme?: string;
  canvas?: string;
  accentColor?: string;
  model?: string;
}): Promise<DeckOutline> {
  const resp = await fetch(`${env.AI_ENGINE_URL}/outline`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: params.prompt,
      noOfSlides: params.noOfSlides,
      deckType: params.deckType,
      theme: params.theme,
      canvas: params.canvas,
    }),
  });

  const body: any = await resp.json().catch(() => null);
  if (!resp.ok || !body?.slides) {
    logger.error({ status: resp.status, body }, "ai-engine /outline failed");
    throw ApiError.serviceUnavailable(
      "Couldn't generate an outline. Please try again.",
    );
  }

  const saved = await Outline.create({
    workspaceId: params.workspaceId,
    authorId: params.userId,
    prompt: params.prompt,
    deckType: params.deckType ?? "general",
    theme: params.theme ?? "corporate",
    canvas: params.canvas ?? "widescreen_16_9",
    accentColor: params.accentColor ?? "",
    model: params.model ?? "gpt-5-nano",
    deckTitle: body.deckTitle ?? "",
    storyTheme: body.storyTheme ?? "",
    analysis: body.analysis,
    slides: body.slides,
  });

  return { ...(body as DeckOutline), outlineId: String(saved._id) };
}

/**
 * Generate ONE outline card (title + bullets) that fits an existing deck, via the
 * ai-engine. Used by the review page's per-card "Generate with AI" action.
 */
export async function requestOutlineCard(params: {
  prompt: string;
  deckTitle?: string;
  storyTheme?: string;
  deckType?: string;
  existingTitles?: string[];
  position?: number;
  hint?: string;
}): Promise<{ title: string; bullets: string[] }> {
  const resp = await fetch(`${env.AI_ENGINE_URL}/outline/slide`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const body: any = await resp.json().catch(() => null);
  if (!resp.ok || typeof body?.title !== "string") {
    logger.error({ status: resp.status, body }, "ai-engine /outline/slide failed");
    throw ApiError.serviceUnavailable(
      "Couldn't generate this card. Please try again.",
    );
  }
  return {
    title: body.title ?? "",
    bullets: Array.isArray(body.bullets) ? body.bullets : [],
  };
}

/**
 * Update a saved outline's editable content (title + slides) so edits made on the
 * review page survive reloads/sessions. Scoped to the owning workspace.
 */
export async function updateOutline(
  outlineId: string,
  workspaceId: unknown,
  patch: { deckTitle?: string; storyTheme?: string; slides?: OutlineSlide[] },
): Promise<DeckOutline> {
  const doc: any = await Outline.findOneAndUpdate(
    { _id: outlineId, workspaceId },
    {
      ...(patch.deckTitle !== undefined ? { deckTitle: patch.deckTitle } : {}),
      ...(patch.storyTheme !== undefined ? { storyTheme: patch.storyTheme } : {}),
      ...(patch.slides ? { slides: patch.slides } : {}),
    },
    { new: true },
  ).lean();
  if (!doc) throw ApiError.notFound("Outline not found.");
  return {
    outlineId: String(doc._id),
    deckTitle: doc.deckTitle ?? "",
    storyTheme: doc.storyTheme ?? "",
    analysis: doc.analysis,
    slides: (doc.slides ?? []).map((s: any) => ({
      slideNumber: s.slideNumber,
      title: s.title ?? "",
      bullets: Array.isArray(s.bullets) ? s.bullets : [],
      slideType: s.slideType ?? "",
    })),
  };
}

/** The most recent saved outline for a workspace, or null if none exists. */
export async function getLatestOutline(
  workspaceId: unknown,
): Promise<(DeckOutline & { config: Record<string, unknown> }) | null> {
  const doc: any = await Outline.findOne({ workspaceId })
    .sort({ updatedAt: -1 })
    .lean();
  if (!doc) return null;
  return {
    outlineId: String(doc._id),
    deckTitle: doc.deckTitle ?? "",
    storyTheme: doc.storyTheme ?? "",
    analysis: doc.analysis,
    slides: (doc.slides ?? []).map((s: any) => ({
      slideNumber: s.slideNumber,
      title: s.title ?? "",
      bullets: Array.isArray(s.bullets) ? s.bullets : [],
      slideType: s.slideType ?? "",
    })),
    // The config the outline was generated with, so the review page can restore it.
    config: {
      prompt: doc.prompt ?? "",
      deckType: doc.deckType ?? "general",
      theme: doc.theme ?? "corporate",
      canvas: doc.canvas ?? "widescreen_16_9",
      accentColor: doc.accentColor ?? "",
      model: doc.model ?? "gpt-5-nano",
      noOfSlides: (doc.slides ?? []).length,
    },
  };
}

// The models use the loosely-typed `defineModel` helper, so we describe just the
// fields we touch here. Docs are cast to these when handed to runGeneration.
interface DeckDoc {
  _id: unknown;
  workspaceId: unknown;
  title: string;
  storyTheme?: string;
  deckType: string;
  theme: string;
  canvas: string;
  accentColor?: { name?: string; hex?: string };
  slideOrder: unknown[];
  status: string;
  thumbnailUrl?: string;
  styleCss?: string;
  save(): Promise<unknown>;
}

interface JobDoc {
  _id: unknown;
  prompt?: string;
  params?: {
    noOfSlides?: number;
    deckType?: string;
    theme?: string;
    canvas?: string;
    accentColor?: string;
    outline?: DeckOutline;
  };
  status: string;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  creditsCharged: number;
  progress: { total: number; completed: number };
  error?: string | null;
  save(): Promise<unknown>;
}

/**
 * Create the Deck (status: generating) and Job (queued), and charge the
 * workspace upfront. Throws (before any streaming) if credits are insufficient,
 * so the caller can return a normal JSON error.
 */
export async function createGenerationJob(p: GenerateParams) {
  // Per-length cost (base + per-slide) — short decks stay cheap, long decks
  // pay their way. See deckGenerationCost / pricing.ts.
  const cost = deckGenerationCost(p.noOfSlides);

  const deck = await Deck.create({
    workspaceId: p.workspaceId,
    authorId: p.userId,
    title: "Generating…",
    // Resolved canonical values overwrite these once the outline arrives.
    deckType: p.deckType ?? "general",
    theme: p.theme ?? "default",
    canvas: p.canvas ?? "widescreen_16_9",
    status: "generating",
  });

  const job = await Job.create({
    deckId: deck._id,
    workspaceId: p.workspaceId,
    userId: p.userId,
    type: "generate",
    prompt: p.prompt,
    params: {
      noOfSlides: p.noOfSlides,
      deckType: p.deckType,
      theme: p.theme,
      canvas: p.canvas,
      accentColor: p.accentColor,
      outline: p.outline,
    },
    status: "queued",
    progress: { total: p.noOfSlides, completed: 0 },
  });

  const jobDoc = job as unknown as JobDoc;

  // Charge upfront; refunded if generation fails. Throws if balance too low.
  await recordCredit(p.workspaceId, -cost, "generation", jobDoc._id);
  jobDoc.creditsCharged = cost;
  await jobDoc.save();

  return { deck: deck as unknown as DeckDoc, job: jobDoc, cost };
}

/**
 * Re-render a single slide's HTML from an edited structured content object,
 * using the engine's pure renderer. Used by the editor's structured panel.
 */
export async function renderSlideContent(
  content: unknown,
  opts: { theme?: string; canvas?: string; accentColor?: string },
): Promise<string> {
  return (await renderSlideContentWithCss(content, opts)).html;
}

/**
 * Like `renderSlideContent` but also returns the deck-wide stylesheet the engine
 * emits — used by the theme switcher to refresh `deck.styleCss` after restyling.
 */
export async function renderSlideContentWithCss(
  content: unknown,
  opts: { theme?: string; canvas?: string; accentColor?: string },
): Promise<{ html: string; css: string }> {
  const resp = await fetch(`${env.AI_ENGINE_URL}/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slide: content, ...opts }),
  });
  const body: any = await resp.json().catch(() => null);
  if (!resp.ok || typeof body?.html !== "string") {
    logger.error({ status: resp.status, body }, "ai-engine /render failed");
    throw ApiError.serviceUnavailable("Couldn't render the slide. Try again.");
  }
  return { html: body.html, css: typeof body.css === "string" ? body.css : "" };
}

type Send = (event: string, data: unknown) => void;

interface RunOptions {
  send: Send;
  isClientGone: () => boolean;
}

/** Parse one SSE frame into `{ event, data }`. */
function parseFrame(frame: string): { event: string; data: any } {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith(":")) continue; // heartbeat comment
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  const raw = dataLines.join("\n");
  return { event, data: raw ? JSON.parse(raw) : {} };
}

/**
 * Drive the ai-engine's streaming `/jobs` endpoint: relay each event to the
 * client while persisting the deck, its slides, and job progress. Refunds the
 * charge if generation fails outright.
 */
export async function runGeneration(
  deck: DeckDoc,
  job: JobDoc,
  { send, isClientGone }: RunOptions,
): Promise<void> {
  const slideIdByNumber = new Map<number, unknown>();

  const fail = async (messages: string) => {
    job.status = "error";
    job.error = messages;
    job.finishedAt = new Date();
    await job.save();
    deck.status = "draft";
    await deck.save();
    // Refund the upfront charge.
    if (job.creditsCharged > 0) {
      await recordCredit(deck.workspaceId, job.creditsCharged, "refund", job._id);
    }
    send("error", { error: messages });
  };

  try {
    job.status = "streaming";
    job.startedAt = new Date();
    await job.save();

    const resp = await fetch(`${env.AI_ENGINE_URL}/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: job.prompt,
        noOfSlides: job.params?.noOfSlides,
        deckType: job.params?.deckType,
        theme: job.params?.theme,
        canvas: job.params?.canvas,
        accentColor: job.params?.accentColor,
        outline: job.params?.outline,
      }),
    });

    if (!resp.ok || !resp.body) {
      logger.error({ status: resp.status }, "ai-engine /jobs unavailable");
      return fail("The generation engine is unavailable. Please try again.");
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
        if (!frame.trim()) continue;
        await handleEvent(parseFrame(frame));
      }

      if (isClientGone()) {
        await reader.cancel();
        break;
      }
    }
  } catch (err) {
    logger.error({ err, deckId: deck._id }, "Generation run failed");
    if (job.status !== "error") {
      await fail("Generation failed unexpectedly. Please try again.");
    }
  }

  async function handleEvent({ event, data }: { event: string; data: any }) {
    switch (event) {
      case "outline": {
        // Lock in the engine's resolved deck config.
        deck.title = data.deckTitle ?? deck.title;
        if (data.storyTheme) deck.storyTheme = data.storyTheme;
        deck.deckType = data.deckType ?? deck.deckType;
        deck.theme = data.theme ?? deck.theme;
        deck.canvas = data.canvas ?? deck.canvas;
        if (data.accentColor) deck.accentColor = data.accentColor;
        if (data.css) deck.styleCss = data.css;
        await deck.save();

        // Create a pending slide per outline entry; key by slideNumber.
        const outlineSlides: any[] = data.slides ?? [];
        for (const s of outlineSlides) {
          const created = await Slide.create({
            deckId: deck._id,
            workspaceId: deck.workspaceId,
            position: s.slideNumber,
            slideNumber: s.slideNumber,
            layout: s.layout || "blank",
            title: s.title ?? "",
            status: "pending",
          });
          slideIdByNumber.set(s.slideNumber, created._id);
        }

        job.progress = { total: outlineSlides.length, completed: 0 };
        await job.save();

        send("outline", { deckId: deck._id, jobId: job._id, ...data });
        break;
      }

      case "slide": {
        const slideId = slideIdByNumber.get(data.slideNumber);
        if (slideId) {
          await Slide.findByIdAndUpdate(slideId, {
            layout: data.layout || "blank",
            html: data.html ?? "",
            // Full structured content from the engine so the slide is editable;
            // fall back to image refs if an older engine omits it.
            content: data.content ?? {
              imageUrl: data.imageUrl ?? null,
              aiImage: data.aiImage ?? null,
            },
            status: "ready",
          });
        }
        job.progress.completed += 1;
        await job.save();

        // Catalogue any image this slide carries into the workspace media library
        // (deduped by URL). Skip the vision describe for bulk-generation images —
        // they're already searchable by their prompt + slide title.
        const slideImageUrl = data.content?.imageUrl || data.imageUrl;
        if (slideImageUrl) {
          captureAsset({
            workspaceId: deck.workspaceId,
            url: slideImageUrl,
            source: data.aiImage ? "ai" : "unsplash",
            deckId: deck._id,
            slideId,
            title: data.title,
            prompt:
              data.content?.visualRequirements?.searchQuery || data.title,
            enrich: false,
          });
        }

        send("slide", { ...data, slideId });
        break;
      }

      case "slide_error": {
        const slideId = slideIdByNumber.get(data.slideNumber);
        if (slideId) await Slide.findByIdAndUpdate(slideId, { status: "error" });
        send("slide_error", { ...data, slideId });
        break;
      }

      case "done": {
        // Ordered slide ids by slide number → deck.slideOrder.
        const ordered = [...slideIdByNumber.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([, id]) => id);
        deck.slideOrder = ordered;
        deck.status = "ready";
        await deck.save();

        job.status = "done";
        job.finishedAt = new Date();
        await job.save();

        // Capture a static slide-1 thumbnail so the dashboard ships an <img>
        // URL, not the full HTML+CSS. Fire-and-forget — never blocks the stream.
        queueDeckThumbnail(String(deck._id), deck.workspaceId);

        send("done", {
          deckId: deck._id,
          jobId: job._id,
          slideCount: ordered.length,
        });
        break;
      }

      case "error": {
        await fail(data.error ?? "Generation failed.");
        break;
      }

      default:
        break;
    }
  }
}
