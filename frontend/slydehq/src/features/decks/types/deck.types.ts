export type DeckStatus = "draft" | "generating" | "ready" | "archived";
export type SlideStatus = "pending" | "ready" | "error";

/** Deck list row (GET /decks). */
export interface DeckSummary {
  _id: string;
  title: string;
  deckType: string;
  theme: string;
  canvas: string;
  status: DeckStatus;
  thumbnailUrl?: string;
  /** Shared stylesheet + first slide's HTML, for a live slide-1 thumbnail. */
  styleCss?: string;
  thumbnailHtml?: string | null;
  /** Per-user view state + creator (decorated server-side). */
  lastViewedAt?: string | null;
  favorite?: boolean;
  folderId?: string | null;
  creator?: { name: string; avatar: string } | null;
  createdAt: string;
  updatedAt: string;
}

export type DeckFilter = "all" | "recent" | "created" | "favorites";
export type DeckSortKey = "updated" | "created" | "title" | "viewed";

/** A viewer of a deck (audience analytics). */
export interface DeckViewer {
  userId: string;
  name: string;
  email: string;
  avatar: string;
  lastViewedAt: string;
  viewCount: number;
}

/** Paginated deck list response (GET /decks). */
export interface DeckListResult {
  decks: DeckSummary[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/** Full deck (GET /decks/:id). */
export interface Deck extends DeckSummary {
  workspaceId: string;
  authorId: string;
  styleCss: string;
  slideOrder: string[];
  accentColor?: { name?: string; hex?: string };
}

/** Structured slide content from the engine (shape varies by layout). */
export interface SlideContent {
  title?: string;
  description?: string;
  subtitle?: string;
  bulletPoints?: string[];
  recommendedLayout?: string;
  slideType?: string;
  imageUrl?: string | null;
  [key: string]: unknown;
}

export interface Slide {
  _id: string;
  deckId: string;
  position: number;
  slideNumber?: number;
  layout: string;
  title: string;
  content?: SlideContent;
  html: string;
  status: SlideStatus;
  /** Speaker / presenter notes (editor + Present mode). */
  notes?: string;
}

export type ExportFormat = "pdf" | "pptx" | "png";
export interface DeckExport {
  _id: string;
  format: ExportFormat;
  url: string | null;
  createdAt: string;
}

/** Public-link share settings (owner view). */
export interface ShareSettings {
  token: string;
  url: string;
  enabled: boolean;
  hasPassword: boolean;
  allowDownload: boolean;
  discoverable: boolean;
}

/** A public deck as served to the unauthenticated viewer. */
export interface PublicDeck {
  passwordRequired: boolean;
  allowDownload?: boolean;
  deck?: {
    _id: string;
    title: string;
    canvas: string;
    theme: string;
    styleCss: string;
  };
  slides?: {
    _id: string;
    slideNumber?: number;
    title: string;
    html: string;
    notes: string;
  }[];
}

export interface OutlineSlide {
  slideNumber: number;
  title: string;
  bullets: string[];
  /** Semantic role from the outline agent — threaded to the engine for layout choice. */
  slideType?: string;
}

export interface OutlineAnalysis {
  topicSummary: string;
  audienceProfile: string;
  detectedPresentationType: string;
  keyObjectives: string[];
  narrativeApproach: string;
  toneGuidance: string;
}

export interface DeckOutline {
  deckTitle: string;
  storyTheme: string;
  /** Strategist analysis from the outline agent — round-tripped to /generate so the
   *  content stage gets the same context as the direct-prompt path. */
  analysis?: OutlineAnalysis;
  /** Set once the outline is persisted server-side. */
  outlineId?: string;
  slides: OutlineSlide[];
}

/** Server response for GET /decks/outline/latest — outline plus the config it used. */
export interface LatestOutline extends DeckOutline {
  config: {
    prompt: string;
    deckType: string;
    theme: string;
    canvas: string;
    accentColor: string;
    model: string;
    noOfSlides: number;
  };
}

export interface GenerateParams {
  prompt: string;
  noOfSlides?: number;
  deckType?: string;
  theme?: string;
  canvas?: string;
  accentColor?: string;
  model?: string;
  /** Approved outline to build the deck from (skips re-outlining in the engine). */
  outline?: DeckOutline;
}

/** Config sent to POST /decks/outline. */
export interface OutlineParams {
  prompt: string;
  noOfSlides?: number;
  deckType?: string;
  theme?: string;
  canvas?: string;
  accentColor?: string;
  model?: string;
}

/** OpenAI models offered in the UI. Cosmetic for now — generation runs on the
 *  engine's configured model regardless of selection. */
export const MODEL_OPTIONS = [
  { value: "gpt-5-nano", label: "GPT-5 Nano · fast" },
  { value: "gpt-5-mini", label: "GPT-5 Mini · balanced" },
  { value: "gpt-5", label: "GPT-5 · best quality" },
];

/** Accent colour presets (mirror the ai-engine ACCENT_PRESETS). Empty = theme default. */
export const ACCENT_OPTIONS = [
  { value: "", label: "Default" },
  { value: "blue", label: "Blue", hex: "#2563EB" },
  { value: "teal", label: "Teal", hex: "#0D9488" },
  { value: "green", label: "Green", hex: "#16A34A" },
  { value: "amber", label: "Amber", hex: "#D97706" },
  { value: "rose", label: "Rose", hex: "#E11D48" },
  { value: "purple", label: "Purple", hex: "#7C3AED" },
];

/** Type chips (map to ai-engine deckTypes). */
export const DECK_TYPE_CHIPS = [
  { value: "general", label: "Presentation" },
  { value: "pitch_deck", label: "Pitch deck" },
  { value: "proposal", label: "Proposal" },
  { value: "social_post", label: "Social" },
  { value: "course", label: "Course" },
];

/** Canvas ratios (ai-engine canvas formats). Non-16:9 is social_post only. */
export const CANVAS_OPTIONS = [
  { value: "widescreen_16_9", label: "16:9 Widescreen" },
  { value: "square_1_1", label: "1:1 Square" },
  { value: "vertical_9_16", label: "9:16 Vertical" },
];

/** Card-count presets (engine clamps 5–21). */
export const CARD_COUNT_OPTIONS = [5, 8, 10, 12, 15, 18, 21];

// ── SSE event payloads (from POST /decks/generate) ───────────────────────────
export interface OutlineEvent {
  deckId: string;
  jobId: string;
  deckTitle: string;
  deckType: string;
  theme: string;
  canvas: string;
  css: string;
  accentColor?: { name: string; hex: string } | null;
  slides: Array<{
    slideNumber: number;
    title: string;
    layout: string;
    slideType?: string;
    status: string;
  }>;
}

export interface SlideEvent {
  slideNumber: number;
  layout: string;
  html: string;
  imageUrl?: string | null;
  aiImage?: string;
  status: string;
  slideId?: string;
}

// ── Form options (mirror the ai-engine's accepted values) ────────────────────
export const DECK_TYPE_OPTIONS = [
  { value: "general", label: "General" },
  { value: "pitch_deck", label: "Pitch deck" },
  { value: "strategy_deck", label: "Strategy deck" },
  { value: "proposal", label: "Proposal" },
  { value: "case_study", label: "Case study" },
  { value: "testimonial", label: "Testimonial" },
  { value: "course", label: "Course" },
  { value: "social_post", label: "Social post" },
];

export const THEME_OPTIONS = [
  { value: "corporate", label: "Corporate" },
  { value: "minimal", label: "Minimal" },
  { value: "funky", label: "Funky" },
  { value: "academic", label: "Academic" },
];
