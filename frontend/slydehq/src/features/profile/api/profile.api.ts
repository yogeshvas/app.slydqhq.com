import { apiClient } from "@/lib/api-client";
import type { ApiSuccess } from "@/types/api";

export interface Profile {
  id: string;
  name: string;
  email: string;
  avatar: string;
}

interface UploadUrl {
  uploadUrl: string;
  publicUrl: string;
}

export const profileApi = {
  /** GET /me — the signed-in user's profile. */
  get: () =>
    apiClient
      .get<ApiSuccess<{ user: Profile }>>("/me")
      .then((r) => r.data.data.user),

  /** PATCH /me — update name and/or avatar. */
  update: (patch: { name?: string; avatar?: string }) =>
    apiClient
      .patch<ApiSuccess<{ user: Profile }>>("/me", patch)
      .then((r) => r.data.data.user),

  /**
   * Upload a new avatar: presign → PUT bytes to storage → return the public URL
   * (caller then PATCHes /me with it).
   */
  uploadAvatar: async (file: File): Promise<string> => {
    const { data } = await apiClient.post<ApiSuccess<UploadUrl>>(
      "/me/avatar-url",
      { filename: file.name, contentType: file.type, bytes: file.size },
    );
    const put = await fetch(data.data.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!put.ok) throw new Error("Avatar upload failed. Try again.");
    return data.data.publicUrl;
  },
};
