import { apiClient } from "@/lib/api-client";
import type { ApiSuccess } from "@/types/api";

export interface ApiKey {
  _id: string;
  name: string;
  prefix: string;
  budgetCredits: number | null;
  spentCredits: number;
  enabled: boolean;
  revoked: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

export const apiKeysApi = {
  list: () =>
    apiClient
      .get<ApiSuccess<{ keys: ApiKey[] }>>("/keys")
      .then((r) => r.data.data.keys),

  /** Create → returns the full secret ONCE (`key`) + the stored record. */
  create: (name: string, budgetCredits?: number | null) =>
    apiClient
      .post<ApiSuccess<{ key: string; apiKey: ApiKey }>>("/keys", {
        name,
        budgetCredits: budgetCredits ?? null,
      })
      .then((r) => r.data.data),

  update: (
    id: string,
    patch: { name?: string; budgetCredits?: number | null; enabled?: boolean },
  ) =>
    apiClient
      .patch<ApiSuccess<{ apiKey: ApiKey }>>(`/keys/${id}`, patch)
      .then((r) => r.data.data.apiKey),

  revoke: (id: string) =>
    apiClient
      .delete<ApiSuccess<{ ok: boolean }>>(`/keys/${id}`)
      .then((r) => r.data.data),
};
