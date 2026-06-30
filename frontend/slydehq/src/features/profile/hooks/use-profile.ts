import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { profileApi } from "../api/profile.api";
import { useAuthStore } from "@/features/auth/store/auth.store";

export const profileKeys = { me: ["profile", "me"] as const };

/** The signed-in user's profile (real name/avatar from the server). */
export function useProfile() {
  return useQuery({ queryKey: profileKeys.me, queryFn: profileApi.get });
}

/** Update name/avatar; syncs the auth store so the whole app reflects it. */
export function useUpdateProfile() {
  const qc = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  const user = useAuthStore((s) => s.user);
  return useMutation({
    mutationFn: (patch: { name?: string; avatar?: string }) =>
      profileApi.update(patch),
    onSuccess: (p) => {
      qc.setQueryData(profileKeys.me, p);
      if (user) {
        setUser({ ...user, name: p.name, avatarUrl: p.avatar || undefined });
      }
    },
  });
}
