import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { DeckOutline } from "../types/deck.types";

export interface GenConfig {
  deckType: string;
  canvas: string;
  noOfSlides: number;
  theme: string;
  prompt: string;
  /** Accent preset name (e.g. "teal"); "" = use the theme's own accent. */
  accentColor: string;
  /** OpenAI model id picked in the UI. Persisted; cosmetic for now. */
  model: string;
}

const defaultConfig: GenConfig = {
  deckType: "general",
  canvas: "widescreen_16_9",
  noOfSlides: 10,
  theme: "corporate",
  prompt: "",
  accentColor: "",
  model: "gpt-5-nano",
};

interface GenerationStore {
  config: GenConfig;
  outline: DeckOutline | null;
  setConfig: (partial: Partial<GenConfig>) => void;
  setOutline: (outline: DeckOutline | null) => void;
  reset: () => void;
}

/**
 * Holds the in-progress generation config + outline so the config page and the
 * outline page can share it, and so it survives navigating away and back (and a
 * page reload within the session — persisted to sessionStorage).
 */
export const useGenerationStore = create<GenerationStore>()(
  persist(
    (set) => ({
      config: defaultConfig,
      outline: null,
      setConfig: (partial) =>
        set((s) => ({ config: { ...s.config, ...partial } })),
      setOutline: (outline) => set({ outline }),
      reset: () => set({ config: defaultConfig, outline: null }),
    }),
    {
      name: "slydehq.generation",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
