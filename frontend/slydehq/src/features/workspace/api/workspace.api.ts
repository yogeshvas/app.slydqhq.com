import { apiClient } from "@/lib/api-client";
import type { ApiSuccess } from "@/types/api";
import type { Workspace } from "../types/workspace.types";

export const workspaceApi = {
  /** GET /workspaces/me — current workspace + credit balance. */
  me: () =>
    apiClient
      .get<ApiSuccess<Workspace>>("/workspaces/me")
      .then((res) => res.data.data),
};
