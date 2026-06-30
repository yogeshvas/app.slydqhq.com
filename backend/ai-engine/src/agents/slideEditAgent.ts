import { openAIClient } from "../config/ai.client";

// Tight, edit-only prompt. The model receives the slide's CURRENT structured
// content and a user instruction, and must return the SAME JSON object with ONLY
// the requested change applied. Heavy anti-hallucination guardrails.
const SLIDE_EDIT_PROMPT = `You are a precise slide EDITOR and a domain expert on the deck's topic.
You receive a single slide's current content as JSON, the DECK CONTEXT (what the whole
presentation is about), and an INSTRUCTION describing a change. You return the SAME JSON
object with the requested change applied.

DECK CONTEXT is authoritative for TOPIC: deckContext.deckTitle and deckContext.storyTheme tell
you what this presentation is about. ALL content you write must stay on that topic — never drift
into generic business filler.

TWO MODES — detect which the instruction wants:

A) TWEAK (e.g. "shorten this", "fix the wording", "make it punchier", "change X to Y"):
   - Change ONLY what the instruction asks. Every field not implicated MUST be returned
     byte-for-byte identical to the input.
   - Do NOT invent facts, stats, names, dates, or numbers not already present.

B) GENERATE / EXPAND / REWRITE (e.g. "generate a slide that closes the deal", "write the
   content", "add bullets about X", "make this about Y"):
   - The user is explicitly asking you to AUTHOR content. Write specific, expert, on-topic
     content grounded in deckContext (deckTitle + storyTheme) and your own domain knowledge of
     that subject — exactly as a knowledgeable presenter on THIS topic would.
   - Fill the layout's required data fields (bulletPoints, metrics, flowNodes, phases, chartBars)
     with real, concrete, topic-specific content. NO generic placeholders ("Confirm terms and
     next steps", "Secure decision", "Various benefits"). Tie every line back to the deck's subject.
   - You MAY introduce well-known, plausible specifics for the topic (real frameworks, named tools,
     typical figures). Do NOT fabricate precise proprietary numbers presented as fact.

ALWAYS:
1. Return ONE JSON object with the SAME keys/shape as the input slide. No prose, no markdown.
2. Preserve structural fields exactly unless the instruction is explicitly about them:
   slideNumber, slideType, recommendedLayout, imageUrl, visualRequirements.
3. Keep the writing style, tone, and language consistent with the rest of the deck.

When a TARGET LAYOUT is provided, ADAPT the content to that layout: fill the data fields that
layout needs, drawing on the slide content + deck context. Set recommendedLayout to the target.`;

interface EditArgs {
  slide: any;
  instruction: string;
  /** Optional: adapt the content to this layout (sets recommendedLayout). */
  targetLayout?: string;
  /** Deck-level context (title, story theme, type) so edits stay on-topic. */
  deckContext?: { deckTitle?: string; storyTheme?: string; deckType?: string };
}

/** AI-edit a slide's structured content per an instruction. Returns new content. */
export async function slideEditAgent({
  slide,
  instruction,
  targetLayout,
  deckContext,
}: EditArgs): Promise<any> {
  // Never send the image into the model: it's irrelevant to text edits and a
  // base64 data URI would blow the token budget. Strip it, restore it after.
  const { imageUrl, ...slideForModel } = slide ?? {};

  const input = JSON.stringify(
    {
      instruction,
      deckContext: deckContext ?? null,
      targetLayout: targetLayout ?? null,
      slide: slideForModel,
    },
    null,
    0,
  );

  const response = await openAIClient.responses.create({
    model: "gpt-5-nano",
    reasoning: { effort: "low" },
    instructions: SLIDE_EDIT_PROMPT,
    input: `Return json. Edit the slide per the instruction.\n${input}`,
    text: { format: { type: "json_object" } },
  });

  const edited = JSON.parse(response.output_text);

  // Hard-guard the structural fields: never let the edit pass move the slide to
  // a different slot or silently drop its layout/image.
  return {
    ...slide,
    ...edited,
    slideNumber: slide.slideNumber,
    slideType: edited.slideType ?? slide.slideType,
    recommendedLayout:
      targetLayout ?? edited.recommendedLayout ?? slide.recommendedLayout,
    // Image stays put unless an image op handles it separately.
    imageUrl: slide.imageUrl ?? edited.imageUrl ?? null,
  };
}
