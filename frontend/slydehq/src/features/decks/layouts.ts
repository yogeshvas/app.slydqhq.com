/**
 * Layout options for the editor's layout switcher, grouped for the dropdown.
 * Mirrors the ai-engine LayoutType union. social_* are only valid on
 * social_post decks (square/vertical canvases) — kept in their own group.
 */
export interface LayoutOption {
  value: string;
  label: string;
}
export interface LayoutGroup {
  label: string;
  options: LayoutOption[];
}

const l = (value: string, label: string): LayoutOption => ({ value, label });

/** Layouts that render a photo/illustration — these need an image to look right. */
export const IMAGE_LAYOUTS = new Set([
  "hero",
  "image_left",
  "image_right",
  "quote_image",
]);

export const LAYOUT_GROUPS: LayoutGroup[] = [
  {
    label: "Text & data",
    options: [
      l("minimal", "Minimal (text only)"),
      l("two_column", "Two columns"),
      l("text_flow", "Text + flow diagram"),
      l("text_chart", "Text + bar chart"),
      l("metrics", "Big KPI metrics"),
      l("big_numbers", "Giant stats"),
    ],
  },
  {
    label: "Image",
    options: [
      l("hero", "Hero (cover)"),
      l("image_left", "Image left"),
      l("image_right", "Image right"),
      l("quote_image", "Quote + image"),
    ],
  },
  {
    label: "Impact & compare",
    options: [
      l("split_insight", "Split: problem / solution"),
      l("dark_comparison", "Comparison table"),
      l("dark_steps", "2×2 steps"),
      l("dark_flow", "Connected flow"),
      l("comparison", "Comparison"),
    ],
  },
  {
    label: "Grids & process",
    options: [
      l("icon_grid", "Icon grid"),
      l("challenge_grid", "Challenge cards"),
      l("flow_kpi", "Flow + KPIs"),
      l("numbered_steps_callout", "Numbered steps"),
      l("process_donut", "Process donut"),
      l("staggered_phases", "Phased timeline"),
      l("timeline", "Timeline"),
    ],
  },
  {
    label: "Diagrams",
    options: [
      l("auto_diagram", "Auto diagram"),
      l("funnel_stages", "Funnel"),
      l("arrow_pipeline", "Arrow pipeline"),
      l("pyramid_tiers", "Pyramid tiers"),
      l("circular_flow", "Circular flow"),
      l("venn_overlap", "Venn overlap"),
      l("petal_diagram", "Petal diagram"),
      l("concentric_layers", "Concentric layers"),
      l("tech_ecosystem", "Tech ecosystem"),
      l("architecture", "Architecture"),
    ],
  },
  {
    label: "Social",
    options: [
      l("social_statement", "Social statement"),
      l("social_quote", "Social quote"),
      l("social_stat", "Social stat"),
      l("social_list_card", "Social list"),
      l("social_cta", "Social CTA"),
    ],
  },
];
