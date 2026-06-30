import type { Request, Response } from "express";
import asyncHandler from "../middleware/asyncHandler";
import ApiResponse from "../responses/apiResponse";
import { DEFAULT_SLIDES } from "../config/constants";
import {
  getApiCredits,
  getApiDeck,
  getApiGeneration,
  startApiGeneration,
} from "../services/api-generation.service";
import type { ExportFormat } from "../config/constants";
import type { DeckOutline } from "../services/generation.service";

interface GenBody {
  prompt: string;
  noOfSlides?: number;
  deckType?: string;
  theme?: string;
  canvas?: string;
  accentColor?: string;
  outline?: DeckOutline;
  exports?: ExportFormat[];
  includeSlides?: boolean;
}

/** POST /api/v1/generations — start an async deck generation. */
export const createGeneration = asyncHandler(
  async (req: Request, res: Response) => {
    const caller = req.apiCaller!;
    const b = req.body as GenBody;
    const result = await startApiGeneration(caller, {
      prompt: b.prompt,
      noOfSlides: b.noOfSlides ?? DEFAULT_SLIDES,
      deckType: b.deckType,
      theme: b.theme,
      canvas: b.canvas,
      accentColor: b.accentColor,
      outline: b.outline,
      exports: b.exports,
      includeSlides: b.includeSlides,
    });
    return ApiResponse.created(res, result, "Generation started.");
  },
);

/** GET /api/v1/generations/:id — poll status + result. */
export const getGeneration = asyncHandler(
  async (req: Request, res: Response) => {
    const caller = req.apiCaller!;
    const data = await getApiGeneration(req.params.id as string, caller.workspaceId);
    return ApiResponse.success(res, data, "Generation status.");
  },
);

/** GET /api/v1/decks/:id — a finished deck (meta + slides). */
export const getDeck = asyncHandler(async (req: Request, res: Response) => {
  const caller = req.apiCaller!;
  const data = await getApiDeck(req.params.id as string, caller.workspaceId);
  return ApiResponse.success(res, data, "Deck.");
});

/** GET /api/v1/credits — wallet + per-key budget. */
export const getCredits = asyncHandler(async (req: Request, res: Response) => {
  const data = await getApiCredits(req.apiCaller!);
  return ApiResponse.success(res, data, "Credits.");
});
