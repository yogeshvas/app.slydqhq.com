import { openAIClient } from "../config/ai.client";
import type { DeckType } from "../config/deckTypes";

const OUTLINE_PROMPT = `You are a Presentation Strategist AND a domain expert on every topic.
Given a topic/prompt you design the OUTLINE for a genuinely excellent slide deck — the
same quality a senior consultant would produce, not a generic table of contents. A slide
designer will turn your outline into the finished deck, so it must be specific and rich.

Return ONLY JSON of this exact shape:
{
  "deckTitle": "string — compelling, specific (never 'Presentation' or 'Slide Deck')",
  "storyTheme": "string — one punchy sentence capturing the core message",
  "analysis": {
    "topicSummary": "2-3 sentences describing the topic with real depth",
    "audienceProfile": "who is watching and what they care about (infer if unstated)",
    "detectedPresentationType": "the kind of deck this is",
    "keyObjectives": ["3-5 concrete things this deck must achieve"],
    "narrativeApproach": "one sentence on the arc/flow used",
    "toneGuidance": "professional | inspiring | academic | persuasive | casual (pick + why)"
  },
  "slides": [
    { "slideNumber": 1, "slideType": "string", "title": "string", "bullets": ["string", ...] }
  ]
}

━━━ LABEL EACH SLIDE WITH A slideType ━━━
Give every slide a semantic slideType describing its ROLE in the deck — this drives the visual
design. Slide 1 is always "cover". For the rest, pick the single best-fitting label from:
  market_opportunity, market_analysis, client_challenges, problem, solution_overview, solution,
  product_capabilities, feature_showcase, technical_architecture, integration, business_impact,
  results, roi, financials, data_insight, comparison, competitive_advantage, use_cases,
  methodology, process_overview, implementation_timeline, roadmap, pricing, executive_summary,
  agenda, introduction, key_point, team, about_us, strategic_pillars, ecosystem, segmentation,
  cycle, case_study, conclusion, recommendations, call_to_action.
Choose the type that matches what the slide actually does (a slide of 3 big metrics → business_impact
or roi; a slide contrasting two options → comparison; a 4-step method → methodology). Vary the
types across the deck — different roles produce different, more beautiful layouts.

━━━ BE A DOMAIN EXPERT, NOT A SCRIBE ━━━
You have deep knowledge of every major subject. USE IT. When the prompt is short or vague,
expand it with what a real expert would include. Every content slide must carry REAL substance:
- Use actual names — companies, products, tools, frameworks (e.g. MySQL, PostgreSQL, MongoDB,
  Redis; AWS Lambda, Kubernetes; SPIN Selling, MEDDIC; PyTorch, TensorFlow) — never "Tool X".
- Include real statistics, benchmarks, or comparisons where the topic invites them.
- For comparison topics, name the actual options being compared (e.g. "SQL vs NoSQL"), not "Option A vs B".
- Never write generic filler ("improves efficiency", "leading provider", "various benefits").

━━━ HONOR AN EXPLICIT STRUCTURE ━━━
If the prompt already specifies a slide list, sections, or syllabus, treat that as authoritative:
use those as your slides in that order, enriching EACH with expert bullets and a sharp title.
Only invent the structure yourself when the prompt does not provide one.

━━━ NARRATIVE ARC BY deckType ━━━
deckType is authoritative unless it is "general" (then infer the best arc from the prompt):
- pitch_deck   → Cover → Problem → Market → Solution → Product → Business Model → Traction → Team → Ask
- proposal     → Cover → Client Context/Pain → Solution → Capabilities → Impact → Plan → Pricing → Next Steps
- strategy_deck→ Cover → Exec Summary → Situation → Complication → Options → Recommendation → Roadmap → Next Steps
- case_study   → Cover → Context → Challenge → Approach → Results & Metrics → Quote → CTA
- testimonial  → Cover → Customer → Challenge → Solution → Results & Quote → Summary CTA
- course       → Cover → Learning Objectives → [one module slide per key sub-topic] → Recap → Next Steps
- social_post  → Hook → 2-4 single-idea value cards → Call to Action (ultra-short text, one idea per card)
- general      → infer the best-fitting arc (intro → build-up → details → takeaways)

━━━ RULES ━━━
- Produce EXACTLY noOfSlides slides, numbered 1..noOfSlides in order. Count before returning.
- Slide 1 is the cover: a strong, specific title and "bullets": [].
- Every other slide: a specific, non-generic title plus 2-4 concise bullets. Each bullet is a
  short phrase or "Label: real detail" — real, on-topic, expert content. No placeholders, no lorem.
- social_post slides: dramatically shorter — a single phrase/sentence per card, one idea each.
- Build a logical narrative arc and map every key point the prompt raises to at least one slide.`;

export interface OutlineSlide {
  slideNumber: number;
  title: string;
  bullets: string[];
  /** Semantic role (cover, business_impact, comparison…) — steers layout choice. */
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
  analysis: OutlineAnalysis;
  slides: OutlineSlide[];
}

const CARD_PROMPT = `You are an expert presentation strategist and domain expert.
Given a deck's topic and its existing slide titles, write ONE new slide that fits
naturally at the requested position in the narrative.

Return ONLY JSON: { "title": "string", "bullets": ["string", ...] }

Rules:
- title: specific, non-generic, on-topic — NEVER "Slide title", "New slide", "Untitled".
- 2-4 concise bullets. Each is a short phrase or "Label: detail" with REAL expert
  content — real names, tools, frameworks, or stats where the topic invites them.
  No placeholders, no lorem.
- Do NOT duplicate the topic of any existing slide listed.
- Match the depth and tone implied by the deck title and theme.
- If a "hint" is provided, it states what the user wants THIS slide to cover —
  follow it closely (treat it as the slide's brief) while keeping expert quality.`;

export interface OutlineCardInput {
  prompt: string;
  deckTitle: string;
  storyTheme: string;
  deckType: DeckType;
  existingTitles: string[];
  position: number;
  hint?: string;
}

/** Generate ONE outline card (title + bullets) that fits the deck — fast, no images. */
export async function generateOutlineCard(
  input: OutlineCardInput,
): Promise<{ title: string; bullets: string[] }> {
  const response = await openAIClient.responses.create({
    model: "gpt-5-nano",
    reasoning: { effort: "low" },
    instructions: CARD_PROMPT,
    input: `Return JSON.\n${JSON.stringify(input)}`,
    text: { format: { type: "json_object" } },
  });

  const parsed = JSON.parse(response.output_text) as {
    title?: string;
    bullets?: unknown;
  };
  return {
    title: parsed.title ?? "",
    bullets: Array.isArray(parsed.bullets)
      ? parsed.bullets.filter((b): b is string => typeof b === "string" && !!b)
      : [],
  };
}

/** Ask the model for an expert-grade deck outline (titles + bullets + analysis) — no images. */
export async function generateOutline(
  prompt: string,
  noOfSlides: number,
  deckType: DeckType,
): Promise<DeckOutline> {
  const response = await openAIClient.responses.create({
    model: "gpt-5-nano",
    reasoning: { effort: "low" },
    instructions: OUTLINE_PROMPT,
    input: `Return JSON.\n${JSON.stringify({ noOfSlides, prompt, deckType })}`,
    text: { format: { type: "json_object" } },
  });

  const parsed = JSON.parse(response.output_text) as Partial<DeckOutline>;

  // Normalise: ensure sequential numbering and capped slide count.
  const slides = (parsed.slides ?? [])
    .slice(0, noOfSlides)
    .map((s, i) => ({
      slideNumber: i + 1,
      title: s.title ?? "",
      bullets: Array.isArray(s.bullets) ? s.bullets.filter(Boolean) : [],
      slideType: i === 0 ? "cover" : (s.slideType ?? ""),
    }));

  const a = parsed.analysis ?? ({} as Partial<OutlineAnalysis>);
  const analysis: OutlineAnalysis = {
    topicSummary: a.topicSummary ?? prompt,
    audienceProfile: a.audienceProfile ?? "",
    detectedPresentationType: a.detectedPresentationType ?? deckType,
    keyObjectives: Array.isArray(a.keyObjectives) ? a.keyObjectives.filter(Boolean) : [],
    narrativeApproach: a.narrativeApproach ?? parsed.storyTheme ?? "",
    toneGuidance: a.toneGuidance ?? "",
  };

  return {
    deckTitle: parsed.deckTitle ?? "Untitled deck",
    storyTheme: parsed.storyTheme ?? "",
    analysis,
    slides,
  };
}
