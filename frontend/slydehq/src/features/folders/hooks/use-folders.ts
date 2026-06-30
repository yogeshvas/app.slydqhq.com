import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { foldersApi } from "../api/folders.api";
import { deckKeys } from "@/features/decks/hooks/use-decks";

export const folderKeys = {
  all: ["folders"] as const,
  list: () => [...folderKeys.all, "list"] as const,
};

export function useFolders() {
  return useQuery({
    queryKey: folderKeys.list(),
    queryFn: foldersApi.list,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: folderKeys.all });
    qc.invalidateQueries({ queryKey: deckKeys.all });
  };
}

export function useCreateFolder() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ name, color }: { name: string; color?: string }) =>
      foldersApi.create(name, color),
    onSuccess: invalidate,
  });
}

export function useUpdateFolder() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: { name?: string; color?: string };
    }) => foldersApi.update(id, patch),
    onSuccess: invalidate,
  });
}

export function useDeleteFolder() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => foldersApi.remove(id),
    onSuccess: invalidate,
  });
}

export function useMoveDeck() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({
      deckId,
      folderId,
    }: {
      deckId: string;
      folderId: string | null;
    }) => foldersApi.moveDeck(deckId, folderId),
    onSuccess: invalidate,
  });
}
