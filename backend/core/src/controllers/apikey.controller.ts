import type { Request, Response } from "express";
import asyncHandler from "../middleware/asyncHandler";
import ApiResponse from "../responses/apiResponse";
import { getCurrentWorkspace } from "../services/workspace.service";
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  updateApiKey,
} from "../services/apikey.service";

/** GET /keys — the workspace's API keys (never the secret). */
export const listKeys = asyncHandler(async (req: Request, res: Response) => {
  const workspace = await getCurrentWorkspace(req.auth!.id);
  const keys = await listApiKeys(workspace.id);
  return ApiResponse.success(res, { keys }, "API keys loaded.");
});

/** POST /keys — create a key; returns the full secret ONCE. */
export const createKey = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.auth!.id;
  const workspace = await getCurrentWorkspace(userId);
  const { name, budgetCredits } = req.body as {
    name: string;
    budgetCredits?: number | null;
  };
  const result = await createApiKey(workspace.id, userId, name, budgetCredits);
  return ApiResponse.created(res, result, "API key created.");
});

/** PATCH /keys/:id — update name / budget / enabled. */
export const updateKey = asyncHandler(async (req: Request, res: Response) => {
  const workspace = await getCurrentWorkspace(req.auth!.id);
  const { name, budgetCredits, enabled } = req.body as {
    name?: string;
    budgetCredits?: number | null;
    enabled?: boolean;
  };
  const apiKey = await updateApiKey(req.params.id as string, workspace.id, {
    name,
    budgetCredits,
    enabled,
  });
  return ApiResponse.success(res, { apiKey }, "API key updated.");
});

/** DELETE /keys/:id — revoke a key. */
export const deleteKey = asyncHandler(async (req: Request, res: Response) => {
  const workspace = await getCurrentWorkspace(req.auth!.id);
  await revokeApiKey(req.params.id as string, workspace.id);
  return ApiResponse.success(res, { ok: true }, "API key revoked.");
});
