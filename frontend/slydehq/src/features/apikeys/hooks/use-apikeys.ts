import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiKeysApi } from "../api/apikeys.api";

export const apiKeyKeys = {
  all: ["apikeys"] as const,
  list: () => [...apiKeyKeys.all, "list"] as const,
};

export function useApiKeys() {
  return useQuery({ queryKey: apiKeyKeys.list(), queryFn: apiKeysApi.list });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: apiKeyKeys.all });
}

export function useCreateApiKey() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ name, budgetCredits }: { name: string; budgetCredits?: number | null }) =>
      apiKeysApi.create(name, budgetCredits),
    onSuccess: invalidate,
  });
}

export function useUpdateApiKey() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: { name?: string; budgetCredits?: number | null; enabled?: boolean };
    }) => apiKeysApi.update(id, patch),
    onSuccess: invalidate,
  });
}

export function useRevokeApiKey() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => apiKeysApi.revoke(id),
    onSuccess: invalidate,
  });
}
