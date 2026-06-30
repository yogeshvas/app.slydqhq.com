import type { Request, Response } from "express";
import asyncHandler from "../middleware/asyncHandler";
import ApiResponse from "../responses/apiResponse";
import {
  getPublicDeck,
  resolveDownloadableShare,
} from "../services/share.service";
import { exportDeck } from "../services/export.service";
import type { ExportFormat } from "../config/constants";

/**
 * POST /public/decks/:token — resolve a public share. Returns the read-only deck
 * + slides, or `{ passwordRequired: true }` when a password is set and not given.
 * Unauthenticated by design.
 */
export const viewPublicDeck = asyncHandler(
  async (req: Request, res: Response) => {
    const { token } = req.params as { token: string };
    const { password } = req.body as { password?: string };
    const data = await getPublicDeck(token, password);
    return ApiResponse.success(res, data, "Shared deck.");
  },
);

/**
 * POST /public/decks/:token/export — download a shared deck, if the owner allowed
 * downloads (and the password, if any, is supplied). Unauthenticated.
 */
export const exportPublicDeck = asyncHandler(
  async (req: Request, res: Response) => {
    const { token } = req.params as { token: string };
    const { format, password, slideNumbers } = req.body as {
      format: ExportFormat;
      password?: string;
      slideNumbers?: number[];
    };
    const { deckId, workspaceId } = await resolveDownloadableShare(
      token,
      password,
    );
    const result = await exportDeck(
      deckId,
      workspaceId,
      undefined,
      format,
      slideNumbers,
    );
    return ApiResponse.success(res, result, "Export ready.");
  },
);
