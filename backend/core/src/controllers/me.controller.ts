import type { Request, Response } from "express";
import asyncHandler from "../middleware/asyncHandler";
import ApiResponse from "../responses/apiResponse";
import { getMe, updateMe } from "../services/user.service";
import { getCurrentWorkspace } from "../services/workspace.service";
import { createUpload } from "../services/media.service";

/** GET /me — the signed-in user's profile. */
export const getMyProfile = asyncHandler(async (req: Request, res: Response) => {
  const me = await getMe(req.auth!.id);
  return ApiResponse.success(res, { user: me }, "Profile loaded.");
});

/** PATCH /me — update display name and/or avatar URL. */
export const updateMyProfile = asyncHandler(
  async (req: Request, res: Response) => {
    const { name, avatar } = req.body as { name?: string; avatar?: string };
    const me = await updateMe(req.auth!.id, { name, avatar });
    return ApiResponse.success(res, { user: me }, "Profile updated.");
  },
);

/** POST /me/avatar-url — presigned URL to upload an avatar image to storage. */
export const createAvatarUploadUrl = asyncHandler(
  async (req: Request, res: Response) => {
    const workspace = await getCurrentWorkspace(req.auth!.id);
    const { filename, contentType, bytes } = req.body as {
      filename: string;
      contentType: string;
      bytes: number;
    };
    // Reuse the media upload pre-sign (validates type/size, returns a public URL).
    const upload = createUpload(String(workspace.id), {
      filename,
      contentType,
      bytes,
    });
    return ApiResponse.success(res, upload, "Upload URL ready.");
  },
);
