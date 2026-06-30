import type { Request, Response } from "express";
import asyncHandler from "../middleware/asyncHandler";
import ApiResponse from "../responses/apiResponse";
import {
  getCurrentWorkspace,
  listMyWorkspaces,
  switchWorkspace,
} from "../services/workspace.service";

/** GET /workspaces/me — the signed-in user's current workspace + credits. */
export const getMyWorkspace = asyncHandler(
  async (req: Request, res: Response) => {
    const workspace = await getCurrentWorkspace(req.auth!.id);
    return ApiResponse.success(res, workspace, "Workspace loaded.");
  },
);

/** GET /workspaces — every workspace the user belongs to (for the switcher). */
export const listWorkspaces = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaces = await listMyWorkspaces(req.auth!.id);
    return ApiResponse.success(res, workspaces, "Workspaces loaded.");
  },
);

/** POST /workspaces/switch — change the active workspace. */
export const postSwitchWorkspace = asyncHandler(
  async (req: Request, res: Response) => {
    const { workspaceId } = req.body as { workspaceId: string };
    const workspace = await switchWorkspace(req.auth!.id, workspaceId);
    return ApiResponse.success(res, workspace, "Switched workspace.");
  },
);
