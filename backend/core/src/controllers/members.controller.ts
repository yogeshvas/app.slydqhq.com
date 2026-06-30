import type { Request, Response } from "express";
import asyncHandler from "../middleware/asyncHandler";
import ApiResponse from "../responses/apiResponse";
import type { InvitableRole } from "../config/constants";
import {
  acceptInvite,
  getInvitePreview,
  inviteMember,
  leaveWorkspace,
  listMembers,
  removeMember,
  revokeInvite,
  updateMemberRole,
} from "../services/members.service";

/** GET /workspaces/members — members + pending invites for the current workspace. */
export const getMembers = asyncHandler(async (req: Request, res: Response) => {
  const data = await listMembers(req.auth!.id);
  return ApiResponse.success(res, data, "Members loaded.");
});

/** POST /workspaces/members/invite — invite a teammate by email (Pro, manager-only). */
export const postInvite = asyncHandler(async (req: Request, res: Response) => {
  const { email, role } = req.body as { email: string; role: InvitableRole };
  const data = await inviteMember(req.auth!.id, email, role);
  return ApiResponse.created(res, data, "Invite sent.");
});

/** PATCH /workspaces/members/:userId/role — change a member's role. */
export const patchMemberRole = asyncHandler(
  async (req: Request, res: Response) => {
    const { role } = req.body as { role: InvitableRole };
    const data = await updateMemberRole(
      req.auth!.id,
      req.params.userId as string,
      role,
    );
    return ApiResponse.success(res, data, "Role updated.");
  },
);

/** DELETE /workspaces/members/:userId — remove a member. */
export const deleteMember = asyncHandler(async (req: Request, res: Response) => {
  const data = await removeMember(req.auth!.id, req.params.userId as string);
  return ApiResponse.success(res, data, "Member removed.");
});

/** DELETE /workspaces/invites/:id — revoke a pending invite. */
export const deleteInvite = asyncHandler(async (req: Request, res: Response) => {
  const data = await revokeInvite(req.auth!.id, req.params.id as string);
  return ApiResponse.success(res, data, "Invite revoked.");
});

/** POST /workspaces/leave — leave the current workspace. */
export const postLeave = asyncHandler(async (req: Request, res: Response) => {
  const data = await leaveWorkspace(req.auth!.id);
  return ApiResponse.success(res, data, "Left workspace.");
});

/** GET /invites/:token — public preview of an invite (no auth). */
export const getInvite = asyncHandler(async (req: Request, res: Response) => {
  const data = await getInvitePreview(req.params.token as string);
  return ApiResponse.success(res, data, "Invite loaded.");
});

/** POST /invites/:token/accept — accept an invite as the signed-in user. */
export const postAcceptInvite = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await acceptInvite(req.auth!.id, req.params.token as string);
    return ApiResponse.success(res, data, "Invite accepted.");
  },
);
