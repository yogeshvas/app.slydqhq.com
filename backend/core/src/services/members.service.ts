import crypto from "node:crypto";
import { Workspace } from "../models/identity/workspace.model";
import { WorkspaceMember } from "../models/identity/workspace_members.model";
import { WorkspaceInvites } from "../models/identity/workspace_invites.model";
import { User } from "../models/identity/user.model";
import { env } from "../config/env";
import {
  INVITABLE_ROLES,
  INVITE_EXPIRY_DAYS,
  MANAGER_ROLES,
  type InvitableRole,
} from "../config/constants";
import ApiError from "../utils/appError";
import { logger } from "../utils/logger";
import { getCurrentWorkspace } from "./workspace.service";
import { sendInviteEmail } from "./mailer.service";

const normalizeEmail = (e: string) => e.toLowerCase().trim();

// The models are defined via `defineModel` (no TS field typing), so narrow the
// invite shape we read here.
interface InviteShape {
  _id: unknown;
  workspaceId: unknown;
  email: string;
  role: string;
  token: string;
  invitedBy: unknown;
  expiresAt: Date;
  acceptedAt: Date | null;
}

const inviteLink = (token: string) =>
  `${env.FRONTEND_URL.replace(/\/$/, "")}/invite/${token}`;

/** The membership row for (workspace, user), or throw if not a member. */
async function requireMembership(workspaceId: unknown, userId: string) {
  const member = await WorkspaceMember.findOne({
    workspaceId,
    userId,
    status: "active",
  });
  if (!member) throw ApiError.forbidden("You're not a member of this workspace.");
  return member;
}

/** Throw unless the user is an owner/admin of the workspace. */
async function requireManager(workspaceId: unknown, userId: string) {
  const member = await requireMembership(workspaceId, userId);
  if (!MANAGER_ROLES.includes(member.role as never)) {
    throw ApiError.forbidden(
      "Only workspace owners and admins can manage members.",
    );
  }
  return member;
}

/** Members + pending invites for the caller's current workspace. */
export async function listMembers(userId: string) {
  const ws = await getCurrentWorkspace(userId);
  await requireMembership(ws.id, userId);

  const members = await WorkspaceMember.find({
    workspaceId: ws.id,
    status: "active",
  }).lean();

  const users = await User.find({
    _id: { $in: members.map((m) => m.userId) },
  })
    .select("userName email avatar")
    .lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));

  const memberList = members
    .map((m) => {
      const u = byId.get(String(m.userId));
      return {
        userId: String(m.userId),
        name: u?.userName ?? "Unknown",
        email: u?.email ?? "",
        avatar: u?.avatar ?? "",
        role: m.role as string,
        isYou: String(m.userId) === String(userId),
      };
    })
    // Owner first, then admins, then members; you somewhere in there.
    .sort((a, b) => roleRank(a.role) - roleRank(b.role));

  const invites = (await WorkspaceInvites.find({
    workspaceId: ws.id,
    acceptedAt: null,
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .lean()) as unknown as InviteShape[];

  const pending = invites.map((i) => ({
    id: String(i._id),
    email: i.email,
    role: i.role as string,
    link: inviteLink(i.token),
    expiresAt: i.expiresAt,
  }));

  return {
    workspace: { id: ws.id, name: ws.name, plan: ws.plan },
    myRole: ws.role,
    canManage: MANAGER_ROLES.includes(ws.role as never),
    members: memberList,
    invites: pending,
  };
}

function roleRank(role: string): number {
  return role === "owner" ? 0 : role === "admin" ? 1 : 2;
}

/**
 * Invite a teammate by email to the caller's current workspace. Manager-only and
 * Pro-gated (route enforces requirePro). Creates/refreshes the invite and emails
 * a join link. If the invitee already has an account + active membership, that's
 * a conflict.
 */
export async function inviteMember(
  userId: string,
  rawEmail: string,
  role: InvitableRole,
) {
  if (!INVITABLE_ROLES.includes(role)) {
    throw ApiError.badRequest("Invalid role.");
  }
  const ws = await getCurrentWorkspace(userId);
  const inviter = await requireManager(ws.id, userId);
  const email = normalizeEmail(rawEmail);

  const me = await User.findById(userId).lean();
  if (email === ((me?.email as string | undefined) ?? "")) {
    throw ApiError.badRequest("You can't invite yourself.");
  }

  // Already an active member?
  const existingUser = await User.findOne({ email }).lean();
  if (existingUser) {
    const already = await WorkspaceMember.findOne({
      workspaceId: ws.id,
      userId: existingUser._id,
      status: "active",
    }).lean();
    if (already) {
      throw ApiError.conflict("That person is already a member of this workspace.");
    }
  }

  // One active invite per (workspace, email): refresh it rather than duplicate.
  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 86_400_000);

  await WorkspaceInvites.findOneAndUpdate(
    { workspaceId: ws.id, email, acceptedAt: null },
    {
      workspaceId: ws.id,
      email,
      role,
      token,
      invitedBy: userId,
      expiresAt,
      acceptedAt: null,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const inviterUser = await User.findById(userId).select("userName").lean();
  const link = inviteLink(token);

  // Best-effort email — the invite still works via the copyable link if mail fails.
  try {
    await sendInviteEmail(email, {
      workspaceName: ws.name,
      inviterName: inviterUser?.userName ?? "A teammate",
      link,
    });
  } catch (err) {
    logger.warn({ err, email }, "invite email failed (link still valid)");
  }

  logger.info(
    { workspaceId: ws.id, email, role, by: inviter.userId },
    "workspace invite created",
  );

  return { email, role, link, expiresAt };
}

/** Public preview of an invite (for the accept page, no auth). */
export async function getInvitePreview(token: string) {
  const invite = (await WorkspaceInvites.findOne({
    token,
  }).lean()) as InviteShape | null;
  if (!invite) throw ApiError.notFound("This invite link is invalid.");
  if (invite.acceptedAt) {
    throw ApiError.badRequest("This invite has already been used.");
  }
  if (invite.expiresAt.getTime() < Date.now()) {
    throw ApiError.badRequest("This invite link has expired.");
  }

  const ws = await Workspace.findById(invite.workspaceId).lean();
  const inviter = await User.findById(invite.invitedBy).select("userName").lean();
  return {
    workspaceName: ws?.name ?? "a workspace",
    inviterName: inviter?.userName ?? "A teammate",
    email: invite.email,
    role: invite.role as string,
  };
}

/**
 * Accept an invite as the signed-in user. Adds an active membership, marks the
 * invite used, and makes the joined workspace the user's active one.
 */
export async function acceptInvite(userId: string, token: string) {
  const invite = await WorkspaceInvites.findOne({ token });
  if (!invite) throw ApiError.notFound("This invite link is invalid.");
  const inv = invite as unknown as InviteShape;
  if (inv.acceptedAt) {
    throw ApiError.badRequest("This invite has already been used.");
  }
  if (inv.expiresAt.getTime() < Date.now()) {
    throw ApiError.badRequest("This invite link has expired.");
  }

  // If they're already an active member (incl. the owner who opened their own
  // link), never downgrade them — just switch them into the workspace. Only a
  // brand-new membership takes the invite's role.
  const existing = await WorkspaceMember.findOne({
    workspaceId: invite.workspaceId,
    userId,
  });
  if (existing) {
    if (existing.status !== "active") {
      existing.status = "active";
      await existing.save();
    }
  } else {
    await WorkspaceMember.create({
      workspaceId: invite.workspaceId,
      userId,
      role: invite.role,
      status: "active",
    });
  }

  invite.acceptedAt = new Date();
  await invite.save();

  await User.updateOne(
    { _id: userId },
    { activeWorkspaceId: invite.workspaceId },
  );

  logger.info(
    { workspaceId: invite.workspaceId, userId, isExisting: Boolean(existing) },
    "workspace invite accepted",
  );

  return getCurrentWorkspace(userId);
}

/** Change a member's role (manager-only; can't touch the owner). */
export async function updateMemberRole(
  userId: string,
  targetUserId: string,
  role: InvitableRole,
) {
  if (!INVITABLE_ROLES.includes(role)) {
    throw ApiError.badRequest("Invalid role.");
  }
  const ws = await getCurrentWorkspace(userId);
  await requireManager(ws.id, userId);

  const target = await WorkspaceMember.findOne({
    workspaceId: ws.id,
    userId: targetUserId,
    status: "active",
  });
  if (!target) throw ApiError.notFound("That member isn't in this workspace.");
  if (target.role === "owner") {
    throw ApiError.badRequest("The workspace owner's role can't be changed.");
  }

  target.role = role;
  await target.save();
  return { userId: targetUserId, role };
}

/** Remove a member (manager-only; can't remove the owner). */
export async function removeMember(userId: string, targetUserId: string) {
  const ws = await getCurrentWorkspace(userId);
  await requireManager(ws.id, userId);

  if (String(targetUserId) === String(userId)) {
    throw ApiError.badRequest("Use “Leave workspace” to remove yourself.");
  }

  const target = await WorkspaceMember.findOne({
    workspaceId: ws.id,
    userId: targetUserId,
  });
  if (!target) throw ApiError.notFound("That member isn't in this workspace.");
  if (target.role === "owner") {
    throw ApiError.badRequest("The workspace owner can't be removed.");
  }

  await WorkspaceMember.deleteOne({ _id: target._id });
  // If they were viewing this workspace, drop them back to their own next request.
  await User.updateOne(
    { _id: targetUserId, activeWorkspaceId: ws.id },
    { activeWorkspaceId: null },
  );

  logger.info({ workspaceId: ws.id, targetUserId }, "workspace member removed");
  return { removed: true };
}

/** Revoke a pending invite (manager-only). */
export async function revokeInvite(userId: string, inviteId: string) {
  const ws = await getCurrentWorkspace(userId);
  await requireManager(ws.id, userId);

  const res = await WorkspaceInvites.deleteOne({
    _id: inviteId,
    workspaceId: ws.id,
    acceptedAt: null,
  });
  if (res.deletedCount === 0) {
    throw ApiError.notFound("That invite no longer exists.");
  }
  return { revoked: true };
}

/** Leave the current workspace (anyone but the owner). */
export async function leaveWorkspace(userId: string) {
  const ws = await getCurrentWorkspace(userId);
  const member = await requireMembership(ws.id, userId);
  if (member.role === "owner") {
    throw ApiError.badRequest(
      "Owners can't leave their own workspace. Transfer or delete it instead.",
    );
  }
  await WorkspaceMember.deleteOne({ _id: member._id });
  await User.updateOne({ _id: userId }, { activeWorkspaceId: null });
  logger.info({ workspaceId: ws.id, userId }, "member left workspace");
  return { left: true };
}
