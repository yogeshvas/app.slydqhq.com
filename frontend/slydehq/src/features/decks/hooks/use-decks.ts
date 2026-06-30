import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { App } from "antd";
import { decksApi } from "../api/decks.api";
import type { DeckFilter, DeckSortKey } from "../types/deck.types";

export interface DeckListOpts {
  filter?: DeckFilter;
  sort?: DeckSortKey;
  desc?: boolean;
  folderId?: string;
}

export const deckKeys = {
  all: ["decks"] as const,
  list: (opts: DeckListOpts = {}) => [...deckKeys.all, "list", opts] as const,
  search: (q: string) => [...deckKeys.all, "search", q] as const,
  trash: () => [...deckKeys.all, "trash"] as const,
  detail: (id: string) => [...deckKeys.all, "detail", id] as const,
};

const DECK_PAGE_SIZE = 24;

/** The current workspace's decks, paged + infinite ("Load more"). */
export function useDecks(opts: DeckListOpts = {}) {
  return useInfiniteQuery({
    queryKey: deckKeys.list(opts),
    queryFn: ({ pageParam }) =>
      decksApi.list({ ...opts, page: pageParam, limit: DECK_PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  });
}

/** The latest decks — shown as default suggestions in the command palette. */
export function useRecentDecks(enabled: boolean, limit = 8) {
  return useQuery({
    queryKey: [...deckKeys.all, "recent-suggestions", limit] as const,
    queryFn: () => decksApi.list({ limit, sort: "updated", desc: true }),
    enabled,
    select: (r) => r.decks,
  });
}

/** Title + content search for the command palette (debounce in the caller). */
export function useDeckSearch(q: string) {
  return useQuery({
    queryKey: deckKeys.search(q),
    queryFn: () => decksApi.search(q),
    enabled: q.trim().length > 0,
    retry: false, // surface a failure (e.g. route not yet registered) immediately
  });
}

/** Star/unstar a deck; refreshes the lists and toasts the result. */
export function useToggleFavorite() {
  const qc = useQueryClient();
  const { message } = App.useApp();
  return useMutation({
    mutationFn: ({ id, favorite }: { id: string; favorite: boolean }) =>
      decksApi.favorite(id, favorite),
    onSuccess: (_data, { favorite }) => {
      qc.invalidateQueries({ queryKey: deckKeys.all });
      message.success(
        favorite ? "Added to favorites." : "Removed from favorites.",
      );
    },
    onError: () => message.error("Couldn't update favorites."),
  });
}

/** Trashed decks (the Trash page). */
export function useTrash() {
  return useQuery({
    queryKey: deckKeys.trash(),
    queryFn: decksApi.trashList,
  });
}

function useDeckMutation<T>(fn: (id: T) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: deckKeys.all }),
  });
}

/** Move a deck to trash (soft delete). */
export function useTrashDeck() {
  return useDeckMutation<string>((id) => decksApi.trash(id));
}
/** Restore a deck from trash. */
export function useRestoreDeck() {
  return useDeckMutation<string>((id) => decksApi.restore(id));
}
/** Permanently delete a trashed deck. */
export function usePurgeDeck() {
  return useDeckMutation<string>((id) => decksApi.purge(id));
}

/** Permanently delete all trashed decks. */
export function useEmptyTrash() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => decksApi.emptyTrash(),
    onSuccess: () => qc.invalidateQueries({ queryKey: deckKeys.all }),
  });
}

/** A single deck with its slides. Polls while the deck is still generating. */
export function useDeck(id?: string) {
  return useQuery({
    queryKey: deckKeys.detail(id ?? ""),
    queryFn: () => decksApi.get(id as string),
    enabled: Boolean(id),
    // While a deck is generating, poll so the viewer fills in + flips to ready.
    refetchInterval: (query) =>
      query.state.data?.deck.status === "generating" ? 2500 : false,
  });
}
