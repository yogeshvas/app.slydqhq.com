import { apiClient } from "@/lib/api-client";
import type { ApiSuccess } from "@/types/api";

export interface Folder {
  _id: string;
  name: string;
  color: string;
  deckCount: number;
  createdAt?: string;
}

export const foldersApi = {
  /** GET /folders — the workspace's folders with deck counts. */
  list: () =>
    apiClient
      .get<ApiSuccess<{ folders: Folder[] }>>("/folders")
      .then((res) => res.data.data.folders),

  /** POST /folders — create a folder. */
  create: (name: string, color?: string) =>
    apiClient
      .post<ApiSuccess<{ folder: Folder }>>("/folders", { name, color })
      .then((res) => res.data.data.folder),

  /** PATCH /folders/:id — rename / recolor. */
  update: (id: string, patch: { name?: string; color?: string }) =>
    apiClient
      .patch<ApiSuccess<{ folder: Folder }>>(`/folders/${id}`, patch)
      .then((res) => res.data.data.folder),

  /** DELETE /folders/:id — delete (decks become unfiled). */
  remove: (id: string) =>
    apiClient
      .delete<ApiSuccess<{ ok: boolean }>>(`/folders/${id}`)
      .then((res) => res.data.data),

  /** POST /decks/:id/move — file a deck into a folder (null = unfile). */
  moveDeck: (deckId: string, folderId: string | null) =>
    apiClient
      .post<ApiSuccess<{ ok: boolean; folderId: string | null }>>(
        `/decks/${deckId}/move`,
        { folderId },
      )
      .then((res) => res.data.data),
};
