import { Deck } from "../models/content/deck.model";
import { Slide } from "../models/content/slide.model";
import { Job } from "../models/generation/job.model";
import { ApiKey } from "../models/identity/api_keys.model";
import {
  DECK_BASE_CREDITS,
  DECK_PER_SLIDE_CREDITS,
  deckGenerationCost,
} from "../config/pricing";
import { EXPORT_FORMATS, type ExportFormat } from "../config/constants";
import ApiError from "../utils/appError";
import { logger } from "../utils/logger";
import {
  createGenerationJob,
  runGeneration,
  type DeckOutline,
} from "./generation.service";
import { getBalance } from "./credit.service";
import { getOrCreateShare } from "./share.service";
import { exportDeck } from "./export.service";
import type { ApiCaller } from "../middleware/apiAuth";

export interface ApiGenParams {
  prompt: string;
  noOfSlides: number;
  deckType?: string;
  theme?: string;
  canvas?: string;
  accentColor?: string;
  outline?: DeckOutline;
  exports?: ExportFormat[];
  includeSlides?: boolean;
}

/**
 * Start an API deck generation. Billing flow (must stay correct):
 *  1. Per-key budget pre-check (key.spent + cost <= key.budget, if capped).
 *  2. createGenerationJob charges the workspace wallet upfront (throws 402 if low).
 *  3. On success, increment the key's spentCredits.
 *  4. Run generation in the BACKGROUND (no SSE); on failure runGeneration refunds
 *     the wallet AND we roll back the key's spentCredits.
 * Returns the job id (generationId) immediately.
 */
export async function startApiGeneration(caller: ApiCaller, p: ApiGenParams) {
  // Same length-based pricing as the app (base + per-slide). Computed here for
  // the per-key budget gate; createGenerationJob recomputes the identical figure
  // when it charges the shared wallet.
  const cost = deckGenerationCost(p.noOfSlides);

  // 1. Per-key budget gate (separate from the shared wallet).
  if (
    caller.budgetCredits != null &&
    caller.spentCredits + cost > caller.budgetCredits
  ) {
    throw ApiError.paymentRequired(
      `This API key's credit budget is exhausted (${caller.spentCredits}/${caller.budgetCredits}).`,
    );
  }

  // 2. Create deck+job and charge the wallet upfront (throws 402 if insufficient).
  const { deck, job } = await createGenerationJob({
    workspaceId: caller.workspaceId,
    userId: caller.userId,
    prompt: p.prompt,
    noOfSlides: p.noOfSlides,
    deckType: p.deckType,
    theme: p.theme,
    canvas: p.canvas,
    accentColor: p.accentColor,
    outline: p.outline,
  });

  // Tag as API-originated (the "API generated" tab + audit) and store options.
  await Deck.updateOne({ _id: deck._id }, { source: "api" });
  await Job.updateOne(
    { _id: job._id },
    {
      via: "api",
      apiKeyId: caller.keyId,
      apiOptions: { exports: p.exports ?? [], includeSlides: Boolean(p.includeSlides) },
    },
  );

  // 3. Charge the per-key budget counter.
  await ApiKey.updateOne({ _id: caller.keyId }, { $inc: { spentCredits: cost } });

  // 4. Run in the background — no client connection.
  void runApiGenerationInBackground(deck, job, caller, p, cost);

  return { generationId: String(job._id), status: "pending" as const };
}

async function runApiGenerationInBackground(
  deck: any,
  job: any,
  caller: ApiCaller,
  p: ApiGenParams,
  cost: number,
) {
  try {
    await runGeneration(deck, job, {
      send: () => {}, // no SSE for API runs
      isClientGone: () => false,
    });

    // Re-read the job to see how it ended.
    const finished: any = await Job.findById(job._id).lean();
    if (finished?.status === "error") {
      // runGeneration already refunded the wallet — roll back the key budget too.
      await ApiKey.updateOne(
        { _id: caller.keyId },
        { $inc: { spentCredits: -cost } },
      );
      return;
    }

    // Build the result: share URL (+ optional exports + slide JSON).
    const share = await getOrCreateShare(String(deck._id), caller.workspaceId);
    const result: any = { deckId: String(deck._id), url: share.url };

    if (p.exports?.length) {
      const exportsOut: Record<string, string> = {};
      for (const fmt of p.exports) {
        try {
          const r = await exportDeck(
            String(deck._id),
            caller.workspaceId,
            caller.userId,
            fmt,
          );
          exportsOut[fmt] = r.url;
        } catch (err) {
          logger.warn({ err, fmt, deckId: deck._id }, "API export failed");
        }
      }
      result.exports = exportsOut;
    }

    if (p.includeSlides) {
      const slides = await Slide.find({ deckId: deck._id, deletedAt: null })
        .sort({ position: 1 })
        .lean();
      result.slides = slides.map((s: any) => ({
        slideNumber: s.slideNumber,
        title: s.title,
        layout: s.layout,
        content: s.content,
        html: s.html,
      }));
    }

    await Job.updateOne({ _id: job._id }, { apiResult: result });
  } catch (err) {
    logger.error({ err, jobId: job._id }, "API background generation crashed");
    // Best-effort rollback if the job didn't already refund.
    const j: any = await Job.findById(job._id).lean();
    if (j && j.status !== "done") {
      await ApiKey.updateOne(
        { _id: caller.keyId },
        { $inc: { spentCredits: -cost } },
      ).catch(() => {});
    }
  }
}

/** Poll a generation's status + result (scoped to the caller's workspace). */
export async function getApiGeneration(generationId: string, workspaceId: unknown) {
  const job: any = await Job.findOne({
    _id: generationId,
    workspaceId,
    via: "api",
  }).lean();
  if (!job) throw ApiError.notFound("Generation not found.");

  const statusMap: Record<string, string> = {
    queued: "pending",
    streaming: "processing",
    done: "completed",
    error: "failed",
  };
  const status = statusMap[job.status] ?? "pending";

  const base = {
    generationId: String(job._id),
    status,
    progress: job.progress,
  };
  if (status === "completed" && job.apiResult) {
    return { ...base, ...job.apiResult };
  }
  if (status === "failed") {
    return { ...base, error: job.error ?? "Generation failed." };
  }
  return base;
}

/** Wallet + per-key budget snapshot for the caller. */
export async function getApiCredits(caller: ApiCaller) {
  const balance = await getBalance(caller.workspaceId);
  return {
    balance,
    keyBudget: caller.budgetCredits,
    keySpent: caller.spentCredits,
    keyRemaining:
      caller.budgetCredits != null
        ? Math.max(caller.budgetCredits - caller.spentCredits, 0)
        : null,
    // Deck cost scales with length: base + perSlide × slides.
    deckPricing: {
      base: DECK_BASE_CREDITS,
      perSlide: DECK_PER_SLIDE_CREDITS,
      example: { slides: 10, credits: deckGenerationCost(10) },
    },
  };
}

/** A finished API deck's meta + slides (for GET /v1/decks/:id). */
export async function getApiDeck(deckId: string, workspaceId: unknown) {
  const deck: any = await Deck.findOne({
    _id: deckId,
    workspaceId,
    deletedAt: null,
  }).lean();
  if (!deck) throw ApiError.notFound("Deck not found.");
  const slides = await Slide.find({ deckId, deletedAt: null })
    .sort({ position: 1 })
    .lean();
  const share = await getOrCreateShare(deckId, workspaceId);
  return {
    deckId: String(deck._id),
    title: deck.title,
    theme: deck.theme,
    canvas: deck.canvas,
    url: share.url,
    slides: slides.map((s: any) => ({
      slideNumber: s.slideNumber,
      title: s.title,
      layout: s.layout,
      content: s.content,
      html: s.html,
    })),
  };
}

export const SUPPORTED_EXPORT_FORMATS = EXPORT_FORMATS;
