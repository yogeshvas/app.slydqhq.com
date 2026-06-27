import { openAIClient } from "../config/ai.client";
import { SLIDE_AGENT_PROMPT } from "../constants/fineprompt";

function isContentEmpty(slide: any): boolean {
    const hasTitle   = !!(slide.title ?? "").trim();
    const hasDesc    = !!(slide.description ?? "").trim();
    const hasBullets = (slide.bulletPoints ?? []).filter(Boolean).length >= 2;
    const hasMetrics = (slide.metrics ?? []).filter((m: any) => m.value).length >= 1;
    const hasFlow    = (slide.flowNodes ?? []).filter((f: any) => f.label).length >= 2;
    const hasPhases  = (slide.phases ?? []).length >= 1;
    const hasChart   = (slide.chartBars ?? []).filter((b: any) => b.value > 0).length >= 2;
    return !hasTitle || (!hasDesc && !hasBullets && !hasMetrics && !hasFlow && !hasPhases && !hasChart);
}

export const slideCreationAgent = async (analysis: JSON, storyTheme: string, currentSlideContent: any) => {
    const layout = (currentSlideContent.recommendedLayout ?? currentSlideContent.slideType ?? "").toLowerCase();
    const payload = { analysis, storyTheme, currentSlideContent };

    const callModel = async (retrying = false) => {
        const extraInstruction = retrying
            ? `\n\nCRITICAL RETRY: The previous attempt returned empty fields. This is slide type "${currentSlideContent.slideType}" with layout "${layout}". You MUST fill: title, description, AND the correct data array for this layout (bulletPoints / metrics / flowNodes / phases). Write specific, expert content. Empty strings are NOT acceptable.`
            : "";

        const response = await openAIClient.responses.create({
            model: "gpt-5-nano",
            reasoning: { effort: "medium" },
            instructions: SLIDE_AGENT_PROMPT,
            input: `Return json.${extraInstruction}\n${JSON.stringify(payload)}`,
            text: { format: { type: "json_object" } },
        });
        return JSON.parse(response.output_text);
    };

    const result = await callModel(false);

    // If the model returned empty content, retry once with a stronger prompt
    if (isContentEmpty(result)) {
        console.warn(`[SlideAgent] Empty content for slide ${currentSlideContent.slideNumber} (${layout}) — retrying`);
        try {
            const retry = await callModel(true);
            return isContentEmpty(retry) ? result : retry;
        } catch {
            return result;
        }
    }

    return result;
};
