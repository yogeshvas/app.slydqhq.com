import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { mediaApi } from "../api/media.api";
import type { MediaFilters } from "../types";

export const mediaKeys = {
  all: ["media"] as const,
  list: (filters: MediaFilters) => [...mediaKeys.all, "list", filters] as const,
  tags: () => [...mediaKeys.all, "tags"] as const,
};

/** A page of the media library for the given filters (server-side search). */
export function useMedia(filters: MediaFilters) {
  return useQuery({
    queryKey: mediaKeys.list(filters),
    queryFn: () => mediaApi.list(filters),
    placeholderData: keepPreviousData, // keep the grid while typing a search
  });
}

/** Distinct tags across the workspace (for the filter UI). */
export function useMediaTags() {
  return useQuery({
    queryKey: mediaKeys.tags(),
    queryFn: mediaApi.tags,
  });
}

function useInvalidateMedia() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: mediaKeys.all });
}

/** Upload a file into the library. */
export function useUploadMedia() {
  const invalidate = useInvalidateMedia();
  return useMutation({
    mutationFn: (file: File) => mediaApi.upload(file),
    onSuccess: invalidate,
  });
}

/** Replace an item's user tags. */
export function useUpdateMediaTags() {
  const invalidate = useInvalidateMedia();
  return useMutation({
    mutationFn: ({ id, tags }: { id: string; tags: string[] }) =>
      mediaApi.updateTags(id, tags),
    onSuccess: invalidate,
  });
}

/** Delete an item. */
export function useDeleteMedia() {
  const invalidate = useInvalidateMedia();
  return useMutation({
    mutationFn: (id: string) => mediaApi.remove(id),
    onSuccess: invalidate,
  });
}
