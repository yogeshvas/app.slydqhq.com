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
 * Resolve the signed-in user's current (default) workspace, with their role and
 * the live credit balance. Self-heals a missing workspace by provisioning one.
 */
export async function getCurrentWorkspace(
  userId: string,
): Promise<CurrentWorkspace> {
  const user = await User.findById(userId);
  if (!user) throw ApiError.unauthorized("User not found.");

  let workspace = user.defaultWorkspaceId
    ? await Workspace.findById(user.defaultWorkspaceId)
    : null;

  // Legacy/edge: user predates auto-provisioning — create one now.
  if (!workspace) {
    workspace = await provisionDefaultWorkspace(user);
  }

  const member = await WorkspaceMember.findOne({
    workspaceId: workspace._id,
    userId: user._id,
  }).lean();

  // Free-tier "come back tomorrow" top-up (no-op for Pro / already done today).
  await applyNewDayTopupIfDue(workspace._id);

  const credits = await getBalance(workspace._id);

  return {
    id: workspace._id,
    name: workspace.name,
    slug: workspace.slug,
    plan: workspace.plan ?? "free",
    currency: (workspace as any).currency ?? "INR",
    role: (member?.role as string | undefined) ?? "owner",
    credits,
  };
}
