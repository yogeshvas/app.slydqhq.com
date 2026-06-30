import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { streamDeckGeneration } from "../api/decks.api";
import { deckKeys } from "./use-decks";
import { workspaceKeys } from "@/features/workspace/hooks/use-workspace";
import type { GenerateParams, SlideStatus } from "../types/deck.types";

export interface GenSlide {
  slideNumber: number;
  title: string;
  layout: string;
  status: SlideStatus;
  html?: string;
}

export type GenStatus = "idle" | "starting" | "streaming" | "done" | "error";

export interface GenState {
  status: GenStatus;
  deckId?: string;
  deckTitle?: string;
  canvas?: string;
  css?: string;
  slides: GenSlide[];
  completed: number;
  total: number;
  error?: string;
}

const initial: GenState = {
  status: "idle",
  slides: [],
  completed: 0,
  total: 0,
};

/**
 * Drives a deck generation: opens the SSE stream and folds outline/slide/done
 * events into a single render-friendly state object.
 */
export function useDeckGeneration() {
  const [state, setState] = useState<GenState>(initial);
  const qc = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => setState(initial), []);

  const run = useCallback(
    (params: GenerateParams) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setState({ ...initial, status: "starting" });

      void streamDeckGeneration(
        params,
        {
          onCreated: ({ deckId }) =>
            setState((s) => ({ ...s, deckId, status: "streaming" })),

          onOutline: (d) =>
            setState((s) => ({
              ...s,
              status: "streaming",
              deckId: d.deckId ?? s.deckId,
              deckTitle: d.deckTitle,
              canvas: d.canvas,
              css: d.css,
              total: d.slides.length,
              slides: d.slides.map((x) => ({
                slideNumber: x.slideNumber,
                title: x.title,
                layout: x.layout,
                status: "pending" as const,
              })),
            })),

          onSlide: (d) =>
            setState((s) => ({
              ...s,
              completed: s.completed + 1,
              slides: s.slides.map((sl) =>
                sl.slideNumber === d.slideNumber
                  ? { ...sl, status: "ready", html: d.html, layout: d.layout }
                  : sl,
              ),
            })),

          onSlideError: (d) =>
            setState((s) => ({
              ...s,
              slides: s.slides.map((sl) =>
                sl.slideNumber === d.slideNumber
                  ? { ...sl, status: "error" }
                  : sl,
              ),
            })),

          onDone: ({ deckId }) => {
            setState((s) => ({ ...s, status: "done", deckId }));
            qc.invalidateQueries({ queryKey: deckKeys.list() });
            qc.invalidateQueries({ queryKey: workspaceKeys.me });
          },

          onError: (message) =>
            setState((s) => ({ ...s, status: "error", error: message })),
        },
        controller.signal,
      ).catch((err) => {
        if (controller.signal.aborted) return;
        setState((s) => ({
          ...s,
          status: "error",
          error: err?.message ?? "Generation failed.",
        }));
      });
    },
    [qc],
  );

  return { state, run, reset };
}
