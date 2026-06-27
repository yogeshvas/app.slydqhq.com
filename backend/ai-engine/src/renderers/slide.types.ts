export interface SlideMetric {
  label: string;
  value: string;
  description?: string;
}

export interface Callout {
  type: "warning" | "danger" | "success" | "info";
  title: string;
  description: string;
}

export interface VisualRequirements {
  searchQuery: string;
  orientation: "landscape" | "portrait" | "square";
  style: string;
}

export interface FlowNode {
  label: string;
  sublabel?: string;
  icon?: string;  // Lucide icon name, e.g. "message-circle", "users", "zap"
}

export interface ChartBar {
  label: string;
  value: number;
  // Original formatted value (e.g. "4.2B", "42M") — shown instead of "{value}%"
  // when the bar represents a non-percentage metric (counts, currency, etc.).
  displayValue?: string;
}

export interface Phase {
  name: string;
  period: string;
  bullets: string[];
}

// ─── AUTO-DIAGRAM ─────────────────────────────────────────────────────────────
// A semantic graph the AI fills in for the `auto_diagram` layout. Positions are
// NEVER specified here — the diagram engine computes all geometry from this.
export interface DiagramNode {
  id: string;
  label: string;
  sublabel?: string;
  icon?: string;
  group?: "left" | "right";
  rowLabel?: string;
}

export interface DiagramEdge {
  from: string;
  to: string;
  label?: string;
}

export interface DiagramSpec {
  diagramType: "tree" | "flow" | "cycle" | "comparison";
  title?: string;
  nodes: DiagramNode[];
  edges?: DiagramEdge[];
  direction?: "horizontal" | "vertical";
}

export interface Slide {
  slideNumber: number;
  slideType: string;
  recommendedLayout?: string;
  headerTag?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  bulletPoints?: string[];
  metrics?: SlideMetric[];
  flowNodes?: FlowNode[];
  chartBars?: ChartBar[];
  phases?: Phase[];
  callouts?: Callout[];
  diagramSpec?: DiagramSpec;
  visualRequirements?: VisualRequirements;
  imageUrl?: string;
}

export interface DeckPayload {
  deckTitle: string;
  storyTheme: string;
  slides: Slide[];
}

export type LayoutType =
  | "hero"
  | "image_left"
  | "image_right"
  | "two_column"
  | "metrics"
  | "timeline"
  | "architecture"
  | "comparison"
  | "minimal"
  | "icon_grid"
  | "challenge_grid"
  | "flow_kpi"
  | "numbered_steps_callout"
  | "process_donut"
  | "staggered_phases"
  | "tech_ecosystem"
  | "text_chart"
  | "text_flow"
  | "quote_image"
  | "dark_steps"
  | "dark_comparison"
  | "dark_flow"
  | "concentric_layers"
  | "big_numbers"
  | "split_insight"
  | "funnel_stages"
  | "arrow_pipeline"
  | "pyramid_tiers"
  | "circular_flow"
  | "venn_overlap"
  | "petal_diagram"
  | "auto_diagram"
  | "social_statement"
  | "social_quote"
  | "social_stat"
  | "social_list_card"
  | "social_cta";
