import { openAIClient } from "../config/ai.client";
import { DECK_TYPE_LAYOUT_POOL, type DeckType } from "../config/deckTypes";

const LAYOUT_INTELLIGENCE_PROMPT = `You are a Visual Design Intelligence Agent for enterprise proposal decks.

Your ONLY job is to assign the best presentation layout to each slide, then return the updated slide list.

You receive a full deck blueprint. For each slide you see: slideNumber, slideType, businessObjective, narrativePurpose.
You return the same slides array with a "recommendedLayout" assigned to every slide.

━━━ AVAILABLE LAYOUTS ━━━

HERO/IMAGE LAYOUTS (use sparingly — only when a photo adds narrative value):
  hero              → Cover slide with full-bleed image LEFT, text RIGHT. Use ONLY for slide 1.
  image_left        → Photo left (40%), content right. Use for market context, opening story slides.
  image_right       → Content left, photo right. Use for case studies, closing narrative slides.
  quote_image       → Large blockquote + photo. Use for executive commitment, testimonial, CTA slides.

TEXT + DATA LAYOUTS (best for analytical content):
  text_flow         → Left: 2-paragraph insight. Right: horizontal 4-5 node flow diagram. Best for market opportunity, solution overview.
  text_chart        → Left: insights + bullets. Right: bar chart. Best for market data, benchmarks, quantified opportunity.
  two_column        → Equal left/right columns with different content. Good for contrasting two ideas.
  metrics           → 3-5 oversized KPI numbers with labels. Use for business impact, investment summary.
  minimal           → Clean text-only, no visuals. Use for pricing, quotes, simple statements.

BIG IMPACT LAYOUTS (high visual punch):
  big_numbers       → 2-3 GIANT stats centered on slide with supporting text. MOST impactful for ROI, benchmark, before/after numbers.
  split_insight     → Left: dark problem panel (challenge/pain). Right: light solution panel. Perfect for competitive positioning, transformation contrast.
  dark_flow         → 4-5 connected circles on white background. Use for solution flow, customer journey, process overview.
  dark_comparison   → Comparison table: "Old Way | New Way" rows. Use for competitive advantage, status quo vs solution.
  dark_steps        → 2×2 numbered grid. Use for 4-step methodology, use case breakdown, implementation steps.

GRID LAYOUTS (structured content):
  challenge_grid    → Grid of pain point cards with colored headers. Use ONLY for client challenges/pain points.
  icon_grid         → Grid of feature/capability cards with icons. Use for product capabilities, feature overview.
  flow_kpi          → Top: horizontal node flow. Bottom: 3 KPI metrics. Good for ROI flow, automation pipeline + results.
  numbered_steps_callout → 4 numbered steps in 2×2 + callout bar. Good for methodology, onboarding steps.

DIAGRAM LAYOUTS:
  process_donut     → Circular numbered process + 3 key metrics. Use for business impact, phased approach.
  staggered_phases  → 4-5 phase timeline with phase details. Use ONLY for implementation timeline.
  concentric_layers → 3 nested rings with callout labels + 4 cards below. Use for architecture, layered platform.
  tech_ecosystem    → Technical stack grid (6 categories). Use for integration landscape, technology overview.
  timeline          → Horizontal milestone timeline. Alternative to staggered_phases for simpler roadmaps.

FLOW & VISUAL DIAGRAM LAYOUTS (high visual impact):
  funnel_stages     → Narrowing trapezoid funnel showing 3-4 stages with values. Perfect for sales funnel, TAM/SAM/SOM, lead pipeline, conversion flow.
  arrow_pipeline    → 4-5 horizontal chevron arrows in sequence. Best for solution pipeline, process flow, implementation sequence.
  pyramid_tiers     → Triangle pyramid with 3 horizontal bands (base=mass, middle, top=premium). Use for segmentation, maturity model, priority hierarchy.
  circular_flow     → 4-5 nodes arranged in a circle connected by curved arrows. Use for continuous improvement cycle, recurring process, agile loop.
  venn_overlap      → 4 overlapping circles in cross pattern with center label and left/right callouts. Use for channel mix, ecosystem overlap, intersection of capabilities.
  petal_diagram     → 4-5 colored leaf/petal shapes arranged in a flower pattern with icons inside and labels outside. Use for 4-5 distinct strategic pillars, HR frameworks, capability wheels, or any content where each item is equally important and visually distinct.
  auto_diagram      → AI-authored relationship diagram (tree / flow / cycle / comparison). The ONLY layout that can express ARBITRARY branching or hierarchy the fixed layouts can't — e.g. one concept fanning out into N children ("Cloud → AWS / GCP / Azure"), a decision/option tree, a branching process, or a custom node-and-arrow map. Use when the content is fundamentally a STRUCTURE of nodes connected by arrows and no fixed layout fits. Do NOT use for a simple linear sequence (use arrow_pipeline) or a plain cycle (use circular_flow).

━━━ LAYOUT SELECTION RULES (HARD RULES — ZERO EXCEPTIONS) ━━━

1. hero MUST appear exactly once — slide 1 only. NEVER assign hero to any other slide.
2. NO layout may appear more than TWICE in the entire deck.
3. NO two consecutive slides may share the same layout.
4. challenge_grid → use only for client pain point / challenge slides.
5. big_numbers → use once, for the highest-impact ROI or business case slide.
6. split_insight → use once, ideally for competitive or transformation contrast.
7. staggered_phases → use only for implementation timeline slides.
8. Spread variety: a 15-slide deck must use at least 12 distinct layouts.
9. After assigning all layouts, verify: count each layout's frequency. Fix any that exceed 2.
10. Prefer high-impact layouts (big_numbers, split_insight, dark_flow, concentric_layers, funnel_stages, pyramid_tiers) — these make decks memorable.
11. funnel_stages → only when the content has a multi-stage narrowing flow (sales, leads, market sizing).
12. pyramid_tiers → only for 3-tier hierarchy (mass/mid/premium, low/mid/high maturity, broad/narrow segmentation).
13. venn_overlap → only when 4 distinct capabilities/channels overlap and share a common center theme.
14. circular_flow → only for cyclic, repeating, or continuous processes (not linear ones — use arrow_pipeline for those).

━━━ LAYOUT → SLIDE TYPE AFFINITY (strong suggestions, not hard rules) ━━━

  PROPOSAL / SALES:
  cover                    → hero
  market_opportunity       → text_flow OR text_chart (alternate between decks)
  client_challenges        → challenge_grid
  solution_overview        → dark_flow OR split_insight
  product_capabilities     → icon_grid
  technical_architecture   → concentric_layers OR tech_ecosystem
  business_impact          → big_numbers OR flow_kpi OR process_donut
  implementation_timeline  → staggered_phases
  pricing                  → minimal OR metrics
  call_to_action           → quote_image
  competitive_advantage    → dark_comparison OR split_insight
  use_cases                → dark_steps OR numbered_steps_callout
  roi                      → big_numbers OR flow_kpi
  integration              → tech_ecosystem OR concentric_layers
  executive_summary        → text_chart OR two_column

  GENERAL PRESENTATION:
  agenda                   → numbered_steps_callout OR icon_grid
  introduction             → text_flow OR image_right
  problem                  → challenge_grid OR split_insight
  solution                 → dark_flow OR split_insight
  key_point                → text_flow OR two_column OR image_right
  data_insight             → text_chart OR big_numbers
  comparison               → dark_comparison OR split_insight
  process_overview         → arrow_pipeline OR numbered_steps_callout OR circular_flow
  methodology              → arrow_pipeline OR numbered_steps_callout
  case_study               → image_right OR quote_image
  team                     → icon_grid OR image_left
  timeline                 → staggered_phases OR timeline
  roadmap                  → staggered_phases OR arrow_pipeline
  market_analysis          → funnel_stages OR text_chart
  feature_showcase         → icon_grid OR petal_diagram
  competitive_analysis     → dark_comparison OR split_insight
  financials               → metrics OR big_numbers
  results                  → big_numbers OR process_donut
  conclusion               → text_flow OR quote_image OR two_column
  recommendations          → dark_steps OR arrow_pipeline
  about_us                 → text_flow OR image_left
  strategic_pillars        → petal_diagram OR icon_grid
  ecosystem                → venn_overlap OR petal_diagram
  segmentation             → pyramid_tiers OR funnel_stages
  cycle                    → circular_flow

━━━ OUTPUT FORMAT ━━━

Return ONLY valid JSON. No markdown. No explanation.

{
  "layouts": [
    { "slideNumber": 1, "recommendedLayout": "hero" },
    { "slideNumber": 2, "recommendedLayout": "text_flow" }
  ]
}
`;

export async function layoutSelectorAgent(
  slides: any[],
  deckTitle: string,
  storyTheme: string,
  deckType: DeckType = "general"
): Promise<any[]> {
  const allowedPool = DECK_TYPE_LAYOUT_POOL[deckType];
  const allowedSet = new Set(allowedPool);
  const fallbackLayout = allowedPool[0];

  try {
    const input = {
      deckTitle,
      storyTheme,
      totalSlides: slides.length,
      allowedLayouts: allowedPool,
      slides: slides.map(s => ({
        slideNumber:      s.slideNumber,
        slideType:        s.slideType,
        title:            s.title ?? "",
        bullets:          s.outlineBullets ?? [],
        businessObjective: s.businessObjective ?? "",
        narrativePurpose:  s.narrativePurpose ?? "",
      })),
    };

    const constraint =
      `\n\nIMPORTANT: choose recommendedLayout ONLY from allowedLayouts: ${allowedPool.join(" | ")}. Never use a layout outside this list.` +
      `\n\nWHEN slideType is "content" or missing: INFER the slide's real role from its title + bullets (e.g. 3 metrics → business_impact; two options contrasted → comparison; a 4-step method → methodology; a funnel/sizing → market_analysis) and pick the matching high-impact layout from the affinity table. NEVER default a content slide to a bullet/image layout just because it has bullets.` +
      `\n\nMAXIMIZE VARIETY — this is the most important rule: assign a DIFFERENT layout to every slide. In a deck of N slides, use N distinct layouts (only repeat a layout if N is larger than the number of suitable layouts). Treat the affinity "OR" options as a way to spread variety across slides.` +
      `\n\nBALANCE PHOTOS WITH STRUCTURE: the photo layouts are hero, image_left, image_right, quote_image, challenge_grid. Use hero for slide 1, PLUS 2-4 other photo layouts spread across the deck for visual richness (stock photos are free, so a deck should never be photo-less). Use data / diagram / text layouts (metrics, big_numbers, text_chart, dark_flow, funnel_stages, pyramid_tiers, concentric_layers, icon_grid, dark_steps, process_donut, arrow_pipeline, etc.) for the REMAINING MAJORITY of slides. Don't make every slide a photo, and don't make the deck text-only either — aim for ~25-30% photo slides, the rest visual-structure layouts.`;

    const response = await openAIClient.responses.create({
      model: "gpt-5-nano",
      reasoning: { effort: "low" },
      instructions: LAYOUT_INTELLIGENCE_PROMPT + constraint,
      input: `Assign optimal layouts. Return JSON only.\n${JSON.stringify(input)}`,
      text: { format: { type: "json_object" } },
    });

    const parsed = JSON.parse(response.output_text);
    const layoutMap: Record<number, string> = {};
    for (const item of parsed.layouts ?? []) {
      layoutMap[item.slideNumber] = item.recommendedLayout;
    }

    // Merge AI layout assignments back onto the slide blueprint, clamping any
    // layout outside the deckType's allowed pool — a stability backstop in case
    // the model ignores the constraint above.
    return slides.map(s => {
      const assigned = layoutMap[s.slideNumber] ?? s.recommendedLayout;
      return {
        ...s,
        recommendedLayout: allowedSet.has(assigned) ? assigned : fallbackLayout,
      };
    });
  } catch (err: any) {
    console.error("[LayoutSelector] failed, keeping strategist layouts:", err?.message);
    // Graceful fallback — keep strategist layouts, but still clamp to the allowed pool.
    return slides.map(s => ({
      ...s,
      recommendedLayout: allowedSet.has(s.recommendedLayout) ? s.recommendedLayout : fallbackLayout,
    }));
  }
}
