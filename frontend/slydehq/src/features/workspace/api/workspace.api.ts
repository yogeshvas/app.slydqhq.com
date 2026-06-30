import { apiClient } from "@/lib/api-client";
import type { ApiSuccess } from "@/types/api";
import type {
  InvitableRole,
  InvitePreview,
  MembersData,
  Workspace,
  WorkspaceSummary,
} from "../types/workspace.types";

export const workspaceApi = {
  /** GET /workspaces/me — current workspace + credit balance. */
  me: () =>
    apiClient
      .get<ApiSuccess<Workspace>>("/workspaces/me")
      .then((res) => res.data.data),

  /** GET /workspaces — all workspaces the user belongs to (switcher). */
  list: () =>
    apiClient
      .get<ApiSuccess<WorkspaceSummary[]>>("/workspaces")
      .then((res) => res.data.data),

  /** POST /workspaces/switch — change the active workspace. */
  switch: (workspaceId: string) =>
    apiClient
      .post<ApiSuccess<Workspace>>("/workspaces/switch", { workspaceId })
      .then((res) => res.data.data),

  /** GET /workspaces/members — members + pending invites. */
  members: () =>
    apiClient
      .get<ApiSuccess<MembersData>>("/workspaces/members")
      .then((res) => res.data.data),

  /** POST /workspaces/members/invite — invite a teammate (Pro). */
  invite: (email: string, role: InvitableRole) =>
    apiClient
      .post<ApiSuccess<{ email: string; role: string; link: string }>>(
        "/workspaces/members/invite",
        { email, role },
      )
      .then((res) => res.data.data),

  /** PATCH /workspaces/members/:userId/role — change a member's role. */
  setRole: (userId: string, role: InvitableRole) =>
    apiClient
      .patch<ApiSuccess<{ userId: string; role: string }>>(
        `/workspaces/members/${userId}/role`,
        { role },
      )
      .then((res) => res.data.data),

  /** DELETE /workspaces/members/:userId — remove a member. */
  removeMember: (userId: string) =>
    apiClient
      .delete<ApiSuccess<{ removed: boolean }>>(`/workspaces/members/${userId}`)
      .then((res) => res.data.data),

  /** DELETE /workspaces/invites/:id — revoke a pending invite. */
  revokeInvite: (inviteId: string) =>
    apiClient
      .delete<ApiSuccess<{ revoked: boolean }>>(`/workspaces/invites/${inviteId}`)
      .then((res) => res.data.data),

  /** POST /workspaces/leave — leave the current workspace. */
  leave: () =>
    apiClient
      .post<ApiSuccess<{ left: boolean }>>("/workspaces/leave")
      .then((res) => res.data.data),

  /** GET /invites/:token — public invite preview (no auth needed). */
  invitePreview: (token: string) =>
    apiClient
      .get<ApiSuccess<InvitePreview>>(`/invites/${token}`)
      .then((res) => res.data.data),

  /** POST /invites/:token/accept — accept an invite (auth required). */
  acceptInvite: (token: string) =>
    apiClient
      .post<ApiSuccess<Workspace>>(`/invites/${token}/accept`)
      .then((res) => res.data.data),
};
