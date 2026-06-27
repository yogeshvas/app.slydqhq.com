import type { LayoutType } from "../renderers/slide.types";

export type DeckType =
  | "pitch_deck"
  | "strategy_deck"
  | "case_study"
  | "testimonial"
  | "social_post"
  | "course"
  | "proposal"
  | "general";

export const DECK_TYPES: DeckType[] = [
  "pitch_deck", "strategy_deck", "case_study", "testimonial",
  "social_post", "course", "proposal", "general",
];

export function resolveDeckType(deckType?: string): DeckType {
  return deckType && (DECK_TYPES as string[]).includes(deckType) ? (deckType as DeckType) : "general";
}

const SOCIAL_LAYOUTS: LayoutType[] = [
  "social_statement", "social_quote", "social_stat", "social_list_card", "social_cta",
];

const LEGACY_LAYOUTS: LayoutType[] = [
  "hero", "image_left", "image_right", "two_column", "metrics", "timeline", "architecture",
  "comparison", "minimal", "icon_grid", "challenge_grid", "flow_kpi", "numbered_steps_callout",
  "process_donut", "staggered_phases", "tech_ecosystem", "text_chart", "text_flow", "quote_image",
  "dark_steps", "dark_comparison", "dark_flow", "concentric_layers", "big_numbers", "split_insight",
  "funnel_stages", "arrow_pipeline", "pyramid_tiers", "circular_flow", "venn_overlap", "petal_diagram",
  "auto_diagram",
];

// social_post is the only deckType that uses the new canvas-agnostic layout set —
// the legacy 32 layouts assume widescreen geometry (side-by-side splits, 2x2 grids).
export const DECK_TYPE_LAYOUT_POOL: Record<DeckType, LayoutType[]> = {
  pitch_deck: LEGACY_LAYOUTS,
  strategy_deck: LEGACY_LAYOUTS,
  case_study: LEGACY_LAYOUTS,
  testimonial: LEGACY_LAYOUTS,
  course: LEGACY_LAYOUTS,
  proposal: LEGACY_LAYOUTS,
  general: LEGACY_LAYOUTS,
  social_post: SOCIAL_LAYOUTS,
};

// How many AI-generated illustrations (gpt-image-1) a deck may use — visual-heavy
// types lean harder on AI art since stock photos rarely fit a custom/funky aesthetic.
export const IMAGE_BUDGET: Record<DeckType, number> = {
  social_post: 6,
  case_study: 4,
  testimonial: 4,
  pitch_deck: 4,
  strategy_deck: 4,
  course: 4,
  proposal: 4,
  general: 4,
};
