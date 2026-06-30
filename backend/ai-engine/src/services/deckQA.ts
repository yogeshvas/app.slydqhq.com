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

// Photo-needing content layouts (besides the cover's hero). We allow a few per deck
// for visual richness — stock photos are FREE (only AI illustrations cost, and that's
// capped separately by IMAGE_BUDGET), so a deck should never be photo-less.
const PHOTO_CONTENT_LAYOUTS = new Set([
  "image_left", "image_right", "quote_image", "challenge_grid",
]);

// Plain-text layouts that can be safely upgraded to a photo layout to guarantee
// some stock imagery without losing meaning (they're just text/columns).
const TEXT_UPGRADABLE = ["minimal", "two_column", "text_flow", "key_point"];

/**
 * Enforce layout variety. Unique-first: each layout is used at most ONCE while the
 * deck still fits distinct layouts; only when a deck is longer than the supply of
 * good layouts does a layout repeat (cap 2). Photo content layouts are allowed up to
 * ~25% of the deck (free Unsplash; AI illustrations capped separately by IMAGE_BUDGET),
 * and a minimum is GUARANTEED so no deck is photo-less.
 */
export function enforceLayoutVariety(slides: any[], deckType: DeckType): any[] {
  const allowedPool = DECK_TYPE_LAYOUT_POOL[deckType];
  // Distinct non-cover layouts available → if the deck is shorter, every slide can
  // be unique. Longer decks (rare) allow a second use of a layout.
  const distinctAvailable = allowedPool.length - 1;
  const perLayoutCap = slides.length <= distinctAvailable ? 1 : 2;

  const used: Record<string, number> = {};
  let photoContentUsed = 0;
  // Allow ~25% of the deck to be photo content slides (besides the cover), min 2 so
  // every deck has stock photos. AI illustrations within these are still capped by
  // IMAGE_BUDGET; the rest resolve to free Unsplash photos.
  const photoContentCap = Math.max(2, Math.min(4, Math.round(slides.length / 4)));
  // social_post uses its own canvas-agnostic layout set (no legacy photo layouts).
  const isSocial = deckType === "social_post";

  const canTake = (a: string): boolean => {
    if ((used[a] ?? 0) >= perLayoutCap) return false;
    // hero is reserved for the cover; never reuse it on content slides.
    if (a === "hero") return false;
    if (PHOTO_CONTENT_LAYOUTS.has(a) && photoContentUsed >= photoContentCap) return false;
    return true;
  };

  const take = (a: string) => {
    used[a] = (used[a] ?? 0) + 1;
    if (PHOTO_CONTENT_LAYOUTS.has(a)) photoContentUsed++;
  };

  const out = slides.map((s, i) => {
    const l = s.recommendedLayout;
    if (!l) return s;
    // Slide 1 keeps its cover layout as-is.
    if (i === 0) {
      take(l);
      return s;
    }
    if (canTake(l)) {
      take(l);
      return s;
    }
    // Substitute the first allowed, not-yet-used, non-photo layout.
    const alt =
      allowedPool.find((a) => (used[a] ?? 0) === 0 && canTake(a)) ??
      allowedPool.find((a) => canTake(a));
    if (!alt) return s;
    take(alt);
    return { ...s, recommendedLayout: alt };
  });

  // GUARANTEE a minimum of photo content slides so every deck shows stock imagery.
  // Upgrade plain-text slides to image_left / image_right (alternating) until met.
  if (!isSocial) {
    const minPhoto = slides.length <= 6 ? 1 : 2;
    const upgradeOptions = ["image_left", "image_right"].filter((a) =>
      allowedPool.includes(a as any),
    );
    let opt = 0;
    for (let i = 1; i < out.length && photoContentUsed < minPhoto; i++) {
      const layout = out[i].recommendedLayout;
      if (PHOTO_CONTENT_LAYOUTS.has(layout)) continue;
      if (!TEXT_UPGRADABLE.includes(layout)) continue;
      const next = upgradeOptions[opt % Math.max(upgradeOptions.length, 1)] ?? "image_left";
      opt++;
      out[i] = { ...out[i], recommendedLayout: next };
      photoContentUsed++;
    }
  }

  return out;
}
