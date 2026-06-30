import type { Request, Response } from "express";
import asyncHandler from "../middleware/asyncHandler";
import ApiResponse from "../responses/apiResponse";
import { getCurrentWorkspace } from "../services/workspace.service";
import {
  createFolder,
  deleteFolder,
  listFolders,
  updateFolder,
} from "../services/folder.service";

/** GET /folders — the workspace's folders with deck counts. */
export const listFoldersController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspace = await getCurrentWorkspace(req.auth!.id);
    const folders = await listFolders(workspace.id);
    return ApiResponse.success(res, { folders }, "Folders loaded.");
  },
);

/** POST /folders — create a folder. */
export const createFolderController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.auth!.id;
    const workspace = await getCurrentWorkspace(userId);
    const { name, color } = req.body as { name: string; color?: string };
    const folder = await createFolder(workspace.id, userId, name, color);
    return ApiResponse.created(res, { folder }, "Folder created.");
  },
);

/** PATCH /folders/:id — rename / recolor a folder. */
export const updateFolderController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspace = await getCurrentWorkspace(req.auth!.id);
    const { name, color } = req.body as { name?: string; color?: string };
    const folder = await updateFolder(req.params.id as string, workspace.id, {
      name,
      color,
    });
    return ApiResponse.success(res, { folder }, "Folder updated.");
  },
);

/** DELETE /folders/:id — delete a folder (its decks become unfiled). */
export const deleteFolderController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspace = await getCurrentWorkspace(req.auth!.id);
    await deleteFolder(req.params.id as string, workspace.id);
    return ApiResponse.success(res, { ok: true }, "Folder deleted.");
  },
);
