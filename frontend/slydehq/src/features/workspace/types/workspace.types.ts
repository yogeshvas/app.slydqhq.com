/** The signed-in user's current workspace (GET /workspaces/me). */
export interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan: string;
  currency?: "INR" | "USD";
  role: string;
  credits: number;
}

/** An entry in the workspace switcher (GET /workspaces). */
export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  avatar: string;
  plan: string;
  role: string;
  credits: number;
  isOwn: boolean;
  isActive: boolean;
}

export type MemberRole = "owner" | "admin" | "member";
export type InvitableRole = "admin" | "member";

/** A teammate in the current workspace. */
export interface Member {
  userId: string;
  name: string;
  email: string;
  avatar: string;
  role: MemberRole;
  isYou: boolean;
}

/** A pending (not-yet-accepted) invite. */
export interface PendingInvite {
  id: string;
  email: string;
  role: InvitableRole;
  link: string;
  expiresAt: string;
}

/** GET /workspaces/members payload. */
export interface MembersData {
  workspace: { id: string; name: string; plan: string };
  myRole: MemberRole;
  canManage: boolean;
  members: Member[];
  invites: PendingInvite[];
}

/** Public preview of an invite (GET /invites/:token). */
export interface InvitePreview {
  workspaceName: string;
  inviterName: string;
  email: string;
  role: InvitableRole;
}
