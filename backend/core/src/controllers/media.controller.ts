import type { Request, Response } from "express";
import asyncHandler from "../middleware/asyncHandler";
import ApiResponse from "../responses/apiResponse";
import { getCurrentWorkspace } from "../services/workspace.service";
import {
  createUpload,
  deleteAsset,
  listAssets,
  listWorkspaceTags,
  registerUpload,
  updateAssetTags,
} from "../services/media.service";
import type { MediaSource } from "../config/constants";

/** GET /media — the workspace library: server-side search + source/tag filters + paging. */
export const listMedia = asyncHandler(async (req: Request, res: Response) => {
  const workspace = await getCurrentWorkspace(req.auth!.id);
  const { source, q, tags, page, limit } = req.query as {
    source?: MediaSource;
    q?: string;
    tags?: string;
    page?: string;
    limit?: string;
  };
  const result = await listAssets({
    workspaceId: workspace.id,
    source,
    q,
    tags: tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });
  return ApiResponse.success(res, result, "Media loaded.");
});

/** GET /media/tags — distinct tags in the workspace (for the filter UI). */
export const listMediaTags = asyncHandler(
  async (req: Request, res: Response) => {
    const workspace = await getCurrentWorkspace(req.auth!.id);
    const tags = await listWorkspaceTags(workspace.id);
    return ApiResponse.success(res, { tags }, "Tags loaded.");
  },
);

/** POST /media/upload-url — mint a presigned PUT URL for a direct-to-storage upload. */
export const createMediaUploadUrl = asyncHandler(
  async (req: Request, res: Response) => {
    const workspace = await getCurrentWorkspace(req.auth!.id);
    const { filename, contentType, bytes } = req.body as {
      filename: string;
      contentType: string;
      bytes: number;
    };
    const upload = createUpload(String(workspace.id), {
      filename,
      contentType,
      bytes,
    });
    return ApiResponse.success(res, upload, "Upload URL ready.");
  },
);

/** POST /media — register an uploaded object as an Asset (after the browser PUT). */
export const registerMediaUpload = asyncHandler(
  async (req: Request, res: Response) => {
    const workspace = await getCurrentWorkspace(req.auth!.id);
    const body = req.body as {
      key: string;
      url: string;
      filename?: string;
      contentType?: string;
      bytes?: number;
      width?: number;
      height?: number;
    };
    const asset = await registerUpload({
      workspaceId: workspace.id,
      authorId: req.auth!.id,
      ...body,
    });
    return ApiResponse.created(res, { asset }, "Media added.");
  },
);

/** PATCH /media/:id — update an asset's user tags. */
export const updateMediaTags = asyncHandler(
  async (req: Request, res: Response) => {
    const workspace = await getCurrentWorkspace(req.auth!.id);
    const { tags } = req.body as { tags: string[] };
    const asset = await updateAssetTags(
      req.params.id as string,
      workspace.id,
      tags,
    );
    return ApiResponse.success(res, { asset }, "Tags updated.");
  },
);

/** DELETE /media/:id — remove an asset (and its stored blob for uploads). */
export const deleteMedia = asyncHandler(async (req: Request, res: Response) => {
  const workspace = await getCurrentWorkspace(req.auth!.id);
  await deleteAsset(req.params.id as string, workspace.id);
  return ApiResponse.success(res, { ok: true }, "Media deleted.");
});
