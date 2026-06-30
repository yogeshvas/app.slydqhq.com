import { apiClient } from "@/lib/api-client";
import type { ApiSuccess } from "@/types/api";
import type { ExportFormat, PublicDeck } from "../types/deck.types";

/**
 * Public (unauthenticated) deck-share endpoints. These hit /public/* which has no
 * auth guard; a stray bearer token from the interceptor is ignored server-side.
 */
export const publicApi = {
  /** Resolve a share token → deck (or { passwordRequired } when gated). */
  view: (token: string, password?: string) =>
    apiClient
      .post<ApiSuccess<PublicDeck>>(`/public/decks/${token}`, { password })
      .then((res) => res.data.data),

  /** Download a shared deck (allowed only if the owner enabled downloads). */
  export: (
    token: string,
    format: ExportFormat,
    password?: string,
    slideNumbers?: number[],
  ) =>
    apiClient
      .post<ApiSuccess<{ url: string; format: ExportFormat }>>(
        `/public/decks/${token}/export`,
        { format, password, slideNumbers },
      )
      .then((res) => res.data.data),
};
