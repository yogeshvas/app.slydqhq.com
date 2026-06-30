import { Workspace } from "../models/identity/workspace.model";
import { WorkspaceMember } from "../models/identity/workspace_members.model";
import { User } from "../models/identity/user.model";
import { SIGNUP_GRANT_CREDITS } from "../config/pricing";
import ApiError from "../utils/appError";
import { logger } from "../utils/logger";
import { getBalance, recordCredit } from "./credit.service";
import { applyNewDayTopupIfDue } from "./topup.service";

type UserDoc = InstanceType<typeof User>;

const slugify = (input: string): string =>
  input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "workspace";

/** Find a free slug, appending a number on collisions. */
async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base);
  let candidate = root;
  let n = 0;
  while (await Workspace.exists({ slug: candidate })) {
    n += 1;
    candidate = `${root}-${n}`;
  }
  return candidate;
}

/**
 * Create a user's default personal workspace: the workspace, an owner
 * membership, a starter credit grant, and the user's defaultWorkspaceId link.
 * Called once, the first time a user is created (any auth path).
 */
export async function provisionDefaultWorkspace(user: UserDoc) {
  const name = `${user.userName}'s Workspace`;
  const slug = await uniqueSlug(user.userName);

  const workspace = await Workspace.create({
    name,
    slug,
    ownerId: user._id,
    plan: "free",
  });

  await WorkspaceMember.create({
    workspaceId: workspace._id,
    userId: user._id,
    role: "owner",
    status: "active",
  });

  await recordCredit(workspace._id, SIGNUP_GRANT_CREDITS, "signup", undefined, {
    kind: "expiring",
  });

  user.defaultWorkspaceId = workspace._id;
  await user.save();

  logger.info(
    { userId: user._id, workspaceId: workspace._id },
    "Provisioned default workspace",
  );

  return workspace;
}

interface CurrentWorkspace {
  id: unknown;
  name: string;
  slug: string;
  plan: string;
  currency: string;
  role: string;
  credits: number;
}

/**
 * Resolve the signed-in user's current workspace, with their role and the live
 * credit balance. Uses the user's `activeWorkspaceId` (which may be a workspace
 * they were invited to), but only if they still have an active membership there;
 * otherwise falls back to their personal `defaultWorkspaceId`. Self-heals a
 * missing default by provisioning one.
 */
export async function getCurrentWorkspace(
  userId: string,
): Promise<CurrentWorkspace> {
  const user = await User.findById(userId);
  if (!user) throw ApiError.unauthorized("User not found.");

  // Prefer the active workspace, but verify membership (it may have been revoked).
  let member = user.activeWorkspaceId
    ? await WorkspaceMember.findOne({
        workspaceId: user.activeWorkspaceId,
        userId: user._id,
        status: "active",
      }).lean()
    : null;

  let workspace = member
    ? await Workspace.findById(user.activeWorkspaceId)
    : null;

  // No valid active workspace → fall back to the personal default.
  if (!workspace) {
    workspace = user.defaultWorkspaceId
      ? await Workspace.findById(user.defaultWorkspaceId)
      : null;

    // Legacy/edge: user predates auto-provisioning — create one now.
    if (!workspace) {
      workspace = await provisionDefaultWorkspace(user);
    }
    // Clear a stale active pointer so we don't re-check it every request.
    if (user.activeWorkspaceId) {
      user.set("activeWorkspaceId", null);
      await user.save();
    }
    member = await WorkspaceMember.findOne({
      workspaceId: workspace._id,
      userId: user._id,
    }).lean();
  }

  // Self-heal: the workspace owner must always have the "owner" role. (A past bug
  // could demote an owner who opened their own invite link — repair it here.)
  let role = (member?.role as string | undefined) ?? "owner";
  if (String(workspace.ownerId) === String(user._id) && role !== "owner") {
    await WorkspaceMember.updateOne(
      { workspaceId: workspace._id, userId: user._id },
      { role: "owner", status: "active" },
    );
    role = "owner";
  }

  // Free-tier "come back tomorrow" top-up (no-op for Pro / already done today).
  await applyNewDayTopupIfDue(workspace._id);

  const credits = await getBalance(workspace._id);

  return {
    id: workspace._id,
    name: workspace.name,
    slug: workspace.slug,
    plan: workspace.plan ?? "free",
    currency: (workspace as any).currency ?? "INR",
    role,
    credits,
  };
}

/**
 * Every workspace the user belongs to (their own + any they were invited to),
 * with role, plan and live credit balance — for the workspace switcher.
 */
export async function listMyWorkspaces(userId: string) {
  const user = await User.findById(userId).lean();
  if (!user) throw ApiError.unauthorized("User not found.");

  const memberships = await WorkspaceMember.find({
    userId,
    status: "active",
  }).lean();

  const activeId = String((user as any).activeWorkspaceId ?? user.defaultWorkspaceId);

  const workspaces = await Promise.all(
    memberships.map(async (m) => {
      const ws = await Workspace.findById(m.workspaceId).lean();
      if (!ws) return null;
      const credits = await getBalance(ws._id);
      return {
        id: String(ws._id),
        name: ws.name,
        slug: ws.slug,
        avatar: (ws as any).avatar ?? "",
        plan: ws.plan ?? "free",
        role: m.role as string,
        credits,
        isOwn: String(ws.ownerId) === String(userId),
        isActive: String(ws._id) === activeId,
      };
    }),
  );

  // Own workspace first, then the rest alphabetically.
  return workspaces
    .filter((w): w is NonNullable<typeof w> => w != null)
    .sort(
      (a, b) => Number(b.isOwn) - Number(a.isOwn) || a.name.localeCompare(b.name),
    );
}

/**
 * Switch the user's active workspace. Validates they have an active membership
 * in the target before persisting the pointer.
 */
export async function switchWorkspace(userId: string, workspaceId: string) {
  const member = await WorkspaceMember.findOne({
    workspaceId,
    userId,
    status: "active",
  });
  if (!member) {
    throw ApiError.forbidden("You're not a member of that workspace.");
  }
  await User.updateOne({ _id: userId }, { activeWorkspaceId: workspaceId });
  return getCurrentWorkspace(userId);
}
