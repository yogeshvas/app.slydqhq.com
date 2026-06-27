import { slideCreationAgent } from "../agents/slideCreationAgent";
import { DECK_TYPE_LAYOUT_POOL, type DeckType } from "../config/deckTypes";

// Layouts whose PRIMARY content is a specific data array — if that array is empty,
// the rendered slide looks broken even when title/description are filled.
const BULLET_REQUIRED_LAYOUTS = new Set([
  "numbered_steps_callout", "dark_steps", "icon_grid", "challenge_grid",
  "tech_ecosystem", "process_donut", "dark_flow",
  "arrow_pipeline", "pyramid_tiers", "circular_flow",
  "comparison", "dark_comparison", "split_insight", "text_chart",
  "two_column", "timeline", "architecture", "text_flow",
  "flow_kpi", "staggered_phases", "funnel_stages",
  "social_list_card",
]);
// Minimum metrics needed before a slide looks intentionally designed rather than sparse.
const METRIC_MINIMUMS: Record<string, number> = {
  big_numbers: 2,
  metrics: 3,
  flow_kpi: 2,
  funnel_stages: 3,
  social_stat: 1,
};
const FLOW_REQUIRED_LAYOUTS = new Set(["text_flow", "dark_flow", "circular_flow"]);
const PHASE_REQUIRED_LAYOUTS = new Set(["staggered_phases"]);

function cap(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// If the AI forgot to fill bulletPoints for a layout that needs them, synthesize
// from description/subtitle. Deterministic and free — tried before any AI retry.
function hydrateBullets(slide: any): any {
  const layout = slide.recommendedLayout ?? "";
  if (!BULLET_REQUIRED_LAYOUTS.has(layout)) return slide;
  const bullets: string[] = (slide.bulletPoints ?? []).filter(Boolean);
  if (bullets.length >= 2) return slide;

  const desc: string = slide.description ?? "";
  const sub: string = slide.subtitle ?? "";

  // Try comma-split of description (catches "A, B, C, and D" patterns)
  const commaParts = desc.split(/[,;]/)
    .map((s: string) => s.trim().replace(/^(and|or)\s+/i, ""))
    .filter((s: string) => s.length > 8);
  if (commaParts.length >= 3) return { ...slide, bulletPoints: commaParts.slice(0, 4) };

  // Try sentence-split
  const sentences = desc.split(/[.!?]+/).map((s: string) => s.trim()).filter((s: string) => s.length > 15);
  if (sentences.length >= 2) return { ...slide, bulletPoints: sentences.slice(0, 4) };

  // Use subtitle as a single bullet if it's meaningful
  if (sub.length > 20) return { ...slide, bulletPoints: [sub] };

  return slide;
}

function hydrateTitle(slide: any): any {
  if (slide.title?.trim()) return slide;
  const fromType = slide.slideType?.replace(/_/g, " ");
  const fromSubtitle = (slide.subtitle ?? "").split(" ").slice(0, 6).join(" ");
  const fromDesc = (slide.description ?? "").split(" ").slice(0, 6).join(" ");
  return { ...slide, title: cap(fromType || fromSubtitle || fromDesc || `Slide ${slide.slideNumber ?? ""}`) };
}

function hydrateSlide(slide: any): any {
  return hydrateBullets(hydrateTitle(slide));
}

// True when a layout's required data array is still empty after deterministic hydration —
// these layouts can't be reliably auto-filled from prose, so they need an AI regeneration pass.
function needsRegeneration(slide: any): boolean {
  const layout = slide.recommendedLayout ?? "";
  if (BULLET_REQUIRED_LAYOUTS.has(layout) && (slide.bulletPoints ?? []).filter(Boolean).length < 2) return true;
  const metricMin = METRIC_MINIMUMS[layout];
  if (metricMin !== undefined && (slide.metrics ?? []).filter((m: any) => m?.value).length < metricMin) return true;
  if (FLOW_REQUIRED_LAYOUTS.has(layout) && (slide.flowNodes ?? []).filter((f: any) => f?.label).length < 2) return true;
  if (PHASE_REQUIRED_LAYOUTS.has(layout) && (slide.phases ?? []).length < 1) return true;
  return false;
}

// Deterministic hydration first (free, instant); if a layout's required data is still
// missing after that, fire one targeted regeneration through slideCreationAgent.
// Capped at one extra attempt — matches the retry budget slideCreationAgent already
// uses internally for empty content.
export async function validateAndFixSlide(slide: any, analysis: any, storyTheme: string): Promise<any> {
  const hydrated = hydrateSlide(slide);
  if (!needsRegeneration(hydrated)) return hydrated;

  try {
    const regenerated = await slideCreationAgent(analysis, storyTheme, slide);
    const merged = {
      ...regenerated,
      slideNumber: slide.slideNumber,
      slideType: regenerated.slideType || slide.slideType,
      recommendedLayout: regenerated.recommendedLayout || slide.recommendedLayout,
    };
    return hydrateSlide(merged);
  } catch {
    return hydrated;
  }
}

// Diagram layouts that look visually similar — group them so they don't all cluster together
const DIAGRAM_GROUP = new Set([
  "arrow_pipeline", "circular_flow", "text_flow", "dark_flow",
]);

// Caps each layout at 2 uses (1 for diagram-group layouts) per deck,
// substituting from the deckType's allowed pool.
export function enforceLayoutVariety(slides: any[], deckType: DeckType): any[] {
  const allowedPool = DECK_TYPE_LAYOUT_POOL[deckType];
  const layoutCount: Record<string, number> = {};
  const subCount: Record<string, number> = {};
  let diagramGroupCount = 0;

  return slides.map(s => {
    const l = s.recommendedLayout;
    if (!l) return s;
    layoutCount[l] = (layoutCount[l] ?? 0) + 1;
    const maxAllowed = DIAGRAM_GROUP.has(l) ? 1 : 2;

    const diagramOverflow = DIAGRAM_GROUP.has(l) && diagramGroupCount >= 2;
    if (layoutCount[l] <= maxAllowed && !diagramOverflow) {
      if (DIAGRAM_GROUP.has(l)) diagramGroupCount++;
      return s;
    }

    const alt = allowedPool.find(a => {
      if ((subCount[a] ?? 0) >= 2) return false;
      if (a === l) return false;
      if (DIAGRAM_GROUP.has(a) && diagramGroupCount >= 2) return false;
      return true;
    });
    if (!alt) return s;
    subCount[alt] = (subCount[alt] ?? 0) + 1;
    return { ...s, recommendedLayout: alt };
  });
}
