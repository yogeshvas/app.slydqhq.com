import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { workspaceApi } from "../api/workspace.api";

export const workspaceKeys = {
  me: ["workspace", "me"] as const,
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
