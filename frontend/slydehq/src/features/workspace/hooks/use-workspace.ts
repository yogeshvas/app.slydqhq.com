import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { workspaceApi } from "../api/workspace.api";
import type { InvitableRole } from "../types/workspace.types";

export const workspaceKeys = {
  me: ["workspace", "me"] as const,
  list: ["workspace", "list"] as const,
  members: ["workspace", "members"] as const,
};

/** The current workspace + credits. Only runs when authenticated. */
export function useWorkspace() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: workspaceKeys.me,
    queryFn: workspaceApi.me,
    enabled: Boolean(token),
    staleTime: 30_000,
  });
}

/** Every workspace the user belongs to (for the switcher). */
export function useWorkspaceList() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: workspaceKeys.list,
    queryFn: workspaceApi.list,
    enabled: Boolean(token),
    staleTime: 30_000,
  });
}

/** Switch active workspace, then refresh everything workspace-scoped. */
export function useSwitchWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (workspaceId: string) => workspaceApi.switch(workspaceId),
    onSuccess: () => {
      // The active workspace changed — decks, media, credits, members all differ.
      qc.invalidateQueries();
    },
  });
}

/** Members + pending invites for the current workspace. */
export function useMembers() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: workspaceKeys.members,
    queryFn: workspaceApi.members,
    enabled: Boolean(token),
  });
}

function useMembersInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: workspaceKeys.members });
}

export function useInviteMember() {
  const invalidate = useMembersInvalidate();
  return useMutation({
    mutationFn: ({ email, role }: { email: string; role: InvitableRole }) =>
      workspaceApi.invite(email, role),
    onSuccess: invalidate,
  });
}

export function useSetMemberRole() {
  const invalidate = useMembersInvalidate();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: InvitableRole }) =>
      workspaceApi.setRole(userId, role),
    onSuccess: invalidate,
  });
}

export function useRemoveMember() {
  const invalidate = useMembersInvalidate();
  return useMutation({
    mutationFn: (userId: string) => workspaceApi.removeMember(userId),
    onSuccess: invalidate,
  });
}

export function useRevokeInvite() {
  const invalidate = useMembersInvalidate();
  return useMutation({
    mutationFn: (inviteId: string) => workspaceApi.revokeInvite(inviteId),
    onSuccess: invalidate,
  });
}
