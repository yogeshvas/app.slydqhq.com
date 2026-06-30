import type { Request, Response } from "express";
import asyncHandler from "../middleware/asyncHandler";
import ApiResponse from "../responses/apiResponse";
import { getCurrentWorkspace } from "../services/workspace.service";

/** GET /workspaces/me — the signed-in user's current workspace + credits. */
export const getMyWorkspace = asyncHandler(
  async (req: Request, res: Response) => {
    const workspace = await getCurrentWorkspace(req.auth!.id);
    return ApiResponse.success(res, workspace, "Workspace loaded.");
  },
);
