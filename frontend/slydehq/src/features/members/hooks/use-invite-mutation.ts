import { useMutation, useQueryClient } from "@tanstack/react-query";
import { workspaceApi } from "@/features/workspace/api/workspace.api";
import { clearStoredInvite } from "../invite-storage";

/**
 * Explicitly accept an invite (the /invite page's Accept button). Clears the
 * stored token and refreshes all workspace-scoped data since the active
 * workspace switches to the joined one.
 */
export function useInviteMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => workspaceApi.acceptInvite(token),
    onSuccess: () => {
      clearStoredInvite();
      qc.invalidateQueries();
    },
  });
}
