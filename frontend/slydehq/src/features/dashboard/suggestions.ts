import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * A pool of friendly dashboard suggestions the "guide" cycles through. Items with
 * a `prompt` are actionable — clicking starts the create flow seeded with it.
 */
export interface Suggestion {
  text: string;
  prompt?: string;
}

export const SUGGESTIONS: Suggestion[] = [
  { text: "Pitch your startup in 10 slides — try it now.", prompt: "An investor pitch deck for my startup" },
  { text: "Turn a topic into a deck: type one line and I'll build it.", prompt: "A presentation about the future of AI" },
  { text: "Need a proposal? I can draft a client proposal deck.", prompt: "A client proposal for a marketing agency" },
  { text: "Make a course outline from a single sentence.", prompt: "A beginner's course on personal finance" },
  { text: "Drag a deck onto a folder to organize your work.", },
  { text: "Out of credits? Top up from the credits chip up top.", },
  { text: "Press ⌘K anywhere to jump to any deck instantly.", },
  { text: "Create a sales deck that actually closes.", prompt: "A B2B SaaS sales deck" },
  { text: "Build a case study deck with real metrics.", prompt: "A customer success case study deck" },
  { text: "Want a social carousel? I can make one too.", prompt: "A 5-slide LinkedIn carousel about productivity" },
  { text: "Star your favorite decks to pin them to Favorites.", },
  { text: "Explain anything visually — give me the subject.", prompt: "A deck explaining how blockchain works" },
  { text: "Quarterly review coming up? I'll structure it.", prompt: "A quarterly business review deck" },
  { text: "Rename a deck inline — just click its title in the editor.", },
  { text: "Make a product launch deck that wows.", prompt: "A product launch announcement deck" },

  // ── Feature highlights (no prompt — tips that teach the app). Add new ones
  // here as features ship, so the guide keeps surfacing what's new. ──
  { text: "Presenting? Hit Present, then press L for a red laser pointer." },
  { text: "In Present mode, use ← → or click the sides to move between slides." },
  { text: "Add speaker notes, then press S during Present to see them." },
  { text: "Share a deck with a public link — set a password if it's private." },
  { text: "Export any deck to PDF, PowerPoint, or PNGs from the Share menu." },
  { text: "Deleted by mistake? Restore it from Trash before emptying." },
  { text: "Toggle these tips off anytime in Settings → Assistant suggestions." },
  { text: "On Pro? Generate decks from code with the API — see Settings → API keys." },
  { text: "Invite a friend — you both get free credits. Settings → Refer & earn." },
  { text: "On Pro? Invite teammates to a shared workspace — Settings → Members." },
  { text: "Switch between your workspaces anytime from the badge up in the rail." },
];

interface SuggestionPrefs {
  /** Whether the guide shows on the dashboard. */
  enabled: boolean;
  /** Advances each dashboard visit so a fresh suggestion leads off every time. */
  seed: number;
  setEnabled: (v: boolean) => void;
  bumpSeed: () => void;
}

export const useSuggestionPrefs = create<SuggestionPrefs>()(
  persist(
    (set) => ({
      enabled: true,
      seed: 0,
      setEnabled: (enabled) => set({ enabled }),
      bumpSeed: () => set((s) => ({ seed: s.seed + 1 })),
    }),
    { name: "slyde_suggestions" },
  ),
);
