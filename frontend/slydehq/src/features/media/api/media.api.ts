import { apiClient } from "@/lib/api-client";
import type { ApiSuccess } from "@/types/api";
import type { MediaFilters, MediaItem, MediaListResult } from "../types";

interface UploadUrlResponse {
  key: string;
  uploadUrl: string;
  publicUrl: string;
  expiresIn: number;
}

/** Read an image File's natural dimensions (best-effort; 0×0 on failure). */
function readImageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve({ width: 0, height: 0 });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

export const mediaApi = {
  /** GET /media — server-side search + source/tag filters + paging. */
  list: (filters: MediaFilters = {}) =>
    apiClient
      .get<ApiSuccess<MediaListResult>>("/media", {
        params: {
          source: filters.source,
          q: filters.q || undefined,
          tags: filters.tags?.length ? filters.tags.join(",") : undefined,
          page: filters.page,
          limit: filters.limit,
        },
      })
      .then((res) => res.data.data),

  /** GET /media/tags — distinct tags in the workspace. */
  tags: () =>
    apiClient
      .get<ApiSuccess<{ tags: string[] }>>("/media/tags")
      .then((res) => res.data.data.tags),

  /** PATCH /media/:id — replace an item's user tags. */
  updateTags: (id: string, tags: string[]) =>
    apiClient
      .patch<ApiSuccess<{ asset: MediaItem }>>(`/media/${id}`, { tags })
      .then((res) => res.data.data.asset),

  /** DELETE /media/:id. */
  remove: (id: string) =>
    apiClient
      .delete<ApiSuccess<{ ok: boolean }>>(`/media/${id}`)
      .then((res) => res.data.data),

  /**
   * Upload a file: mint a presigned URL, PUT the bytes straight to storage
   * (bypassing core), then register the resulting Asset. Returns the new item.
   */
  upload: async (file: File): Promise<MediaItem> => {
    const { width, height } = await readImageSize(file);

    const { data } = await apiClient.post<ApiSuccess<UploadUrlResponse>>(
      "/media/upload-url",
      {
        filename: file.name,
        contentType: file.type,
        bytes: file.size,
      },
    );
    const { key, uploadUrl, publicUrl } = data.data;

    // Direct browser → storage PUT. Not via apiClient (different origin, no auth
    // header, raw body — the presigned URL carries its own auth).
    const put = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!put.ok) {
      throw new Error("Upload to storage failed. Please try again.");
    }

    const reg = await apiClient.post<ApiSuccess<{ asset: MediaItem }>>("/media", {
      key,
      url: publicUrl,
      filename: file.name,
      contentType: file.type,
      bytes: file.size,
      width,
      height,
    });
    return reg.data.data.asset;
  },
};
