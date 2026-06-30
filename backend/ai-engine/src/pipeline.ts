// ─── STREAMING PIPELINE ──────────────────────────────────────────────────────
// Stages the deck pipeline into discrete steps so the engine can emit progress
// between them (Gamma-style slide-by-slide streaming):
//
//   buildOutline()      → strategist + layout selection (fast; the SSE "outline")
//   computeAiSlotSet()  → decide which slides get gpt-image-1 (layout-only, so it
//                         can run at outline time before any content is filled)
//   fillSlide()         → content + image + render for ONE slide (the SSE "slide")
//
// These power POST /jobs in index.ts. The legacy POST /generate keeps its own
// inline pipeline for backward compatibility during the transition.

import { presentationStrategist } from "./agents/presentationStrategist";
import { layoutSelectorAgent } from "./agents/layoutSelectorAgent";
import { slideCreationAgent } from "./agents/slideCreationAgent";
import { validateAndFixSlide, enforceLayoutVariety } from "./services/deckQA";
import { getUnsplashImage } from "./services/unsplash.service";
import { generateIllustration } from "./services/illustration.service";
import { renderSlideHTML, needsPhoto } from "./renderers/pdf.renderer";
import { IMAGE_BUDGET, type DeckType } from "./config/deckTypes";
import { assetUrl } from "./config/assets";
import type { ThemeName } from "./config/themes";
import type { CanvasFormat } from "./config/canvas";
import type { AccentOverride } from "./config/accentColors";

export interface OutlineResult {
  deckTitle: string;
  storyTheme: string;
  analysis: any;
  enrichedAnalysis: any;
  /** Outline slides, each with slideNumber, title, slideType, recommendedLayout. */
  slides: any[];
}

// Stage 1 — produce the deck skeleton: titles + assigned layouts, no content yet.
export async function buildOutline(
  body: any,
  noOfSlides: number,
  deckType: DeckType
): Promise<OutlineResult> {
  let analysis: any;
  let deck: any;

  if (body.outline?.slides?.length) {
    // Caller approved an outline (titles + bullets) — build the skeleton from it
    // instead of re-running the strategist, so generation honors their edits.
    const o = body.outline;
    deck = {
      deckTitle: o.deckTitle ?? "Presentation",
      storyTheme: o.storyTheme ?? body.prompt ?? "",
      slides: o.slides.map((s: any, i: number) => {
        const bullets: string[] = (s.bullets ?? []).filter(Boolean);
        // Use the semantic slideType the outline assigned (cover, business_impact,
        // comparison…) — this is what lights up the layout selector's affinity table
        // and produces VARIETY. Only fall back to "content" if the outline omitted it.
        const slideType = i === 0 ? "cover" : (s.slideType?.trim() || "content");
        return {
          slideNumber: s.slideNumber ?? i + 1,
          slideType,
          title: s.title ?? "",
          // Pass the real title + bullets to the layout agent so it can infer the
          // slide's role and pick a fitting, varied layout (not just a bullet list).
          narrativePurpose: [s.title, ...bullets].filter(Boolean).join(" — "),
          businessObjective: bullets.length
            ? `Cover: ${bullets.join("; ")}`
            : (i === 0 ? "Open the deck with a strong, specific cover" : (s.title ?? "")),
          // The content agent reads currentSlideContent verbatim, so these flow
          // through and steer the written slide toward the approved outline.
          outlineBullets: bullets,
          recommendedLayout: "",
        };
      }),
    };
    // Prefer the rich analysis the outline agent produced (round-tripped via the
    // approved outline); fall back to a minimal one for older/direct API callers.
    // Without this the content writer (which reads topicSummary / audienceProfile /
    // keyObjectives / toneGuidance) is starved and the deck reads thinner than the
    // direct-prompt path.
    const oa = o.analysis ?? {};
    analysis = {
      topicSummary: oa.topicSummary ?? body.prompt ?? deck.storyTheme,
      audienceProfile: oa.audienceProfile ?? "",
      detectedPresentationType: oa.detectedPresentationType ?? deckType,
      keyObjectives: Array.isArray(oa.keyObjectives) ? oa.keyObjectives : [],
      narrativeApproach: oa.narrativeApproach ?? deck.storyTheme,
      toneGuidance: oa.toneGuidance ?? "",
      _userPrompt: body.prompt ?? "",
    };
  } else {
    ({ analysis, deck } = await presentationStrategist(body, noOfSlides, deckType));
  }

  // Layout Intelligence Agent assigns optimal layouts across the whole deck...
  deck.slides = await layoutSelectorAgent(deck.slides, deck.deckTitle, deck.storyTheme, deckType);
  // ...then cap any single layout at two uses.
  deck.slides = enforceLayoutVariety(deck.slides, deckType);

  // Pass the raw user prompt through so the content agent stays on-topic.
  const enrichedAnalysis = { ...analysis, _userPrompt: body.prompt ?? "" };

  return {
    deckTitle: deck.deckTitle,
    storyTheme: deck.storyTheme,
    analysis,
    enrichedAnalysis,
    slides: deck.slides,
  };
}

// Layouts that look best with a generated illustration rather than stock photo.
const AI_PREFERRED_LAYOUTS = new Set([
  "hero", "quote_image", "image_left", "image_right",
  "social_statement", "social_cta", "split_insight",
]);

// Decide which slide indices (in slideNumber order) get a gpt-image-1 image.
// This only depends on layout/slideType — both known from the outline — so it
// runs before any content generation, keeping each slide independently fillable.
export function computeAiSlotSet(slides: any[], deckType: DeckType): Set<number> {
  const sorted = [...slides].sort((a, b) => a.slideNumber - b.slideNumber);
  let remaining = IMAGE_BUDGET[deckType];
  const set = new Set<number>();
  for (let i = 0; i < sorted.length && remaining > 0; i++) {
    const layout = sorted[i].recommendedLayout ?? "";
    const isCover = sorted[i].slideType === "cover" || layout === "hero";
    if (isCover || AI_PREFERRED_LAYOUTS.has(layout)) {
      set.add(i);
      remaining--;
    }
  }
  return set;
}

export interface FillOpts {
  enrichedAnalysis: any;
  storyTheme: string;
  themeName: ThemeName;
  canvas: CanvasFormat;
  accentOverride: AccentOverride | null;
  watermark: boolean;
  /** Whether this slide was granted a gpt-image-1 slot by computeAiSlotSet. */
  isAiSlot: boolean;
  /** Shared across the deck so Unsplash photos don't repeat. */
  usedImageUrls: Set<string>;
}

export interface FilledSlide {
  slideNumber: number;
  layout: string;
  html: string;
  imageUrl: string | null;
  aiImage: { fileName: string; viewUrl: string } | null;
  /** The full slide object, kept so the deck can be exported later. */
  slide: any;
}

// Stage 2 — fully realize ONE outline slide: generate content, QA-fix it,
// resolve its image, and render it to an HTML fragment.
export async function fillSlide(outlineSlide: any, opts: FillOpts): Promise<FilledSlide> {
  const filled = await slideCreationAgent(opts.enrichedAnalysis, opts.storyTheme, outlineSlide);
  const merged = {
    ...filled,
    slideNumber: outlineSlide.slideNumber,
    slideType: filled.slideType || outlineSlide.slideType,
    recommendedLayout: filled.recommendedLayout || outlineSlide.recommendedLayout,
  };
  const qa = await validateAndFixSlide(merged, opts.enrichedAnalysis, opts.storyTheme);

  let imageUrl: string | null = null;
  let aiImage: { fileName: string; viewUrl: string } | null = null;

  if (needsPhoto(qa)) {
    if (opts.isAiSlot) {
      try {
        const result = await generateIllustration(
          qa.slideType ?? "cover",
          qa.title ?? "",
          opts.themeName,
          qa.recommendedLayout,
          opts.canvas,
          opts.accentOverride,
          qa.visualRequirements?.searchQuery
        );
        if (result) {
          // Reference the saved file by URL (kept out of the DB/HTML) — Puppeteer
          // and the browser both load it over HTTP from the engine's static serve.
          imageUrl = assetUrl(result.httpPath);
          aiImage = { fileName: result.fileName, viewUrl: assetUrl(result.httpPath) };
        }
      } catch (aiErr: any) {
        console.error("[Illustration error]", aiErr?.message ?? aiErr);
      }
    }
    // Fall through to Unsplash if no AI slot, or if the AI image failed.
    if (!imageUrl) {
      const url = await getUnsplashImage(
        qa.visualRequirements?.searchQuery ?? "business meeting",
        qa.visualRequirements?.orientation ?? "landscape",
        opts.usedImageUrls
      );
      if (url) {
        opts.usedImageUrls.add(url);
        imageUrl = url;
      }
    }
  }

  const finalSlide = { ...qa, imageUrl };
  const html = renderSlideHTML(
    finalSlide,
    opts.themeName,
    opts.canvas,
    opts.accentOverride,
    opts.watermark
  );

  return {
    slideNumber: finalSlide.slideNumber,
    layout: finalSlide.recommendedLayout ?? "",
    html,
    imageUrl,
    aiImage,
    slide: finalSlide,
  };
}
