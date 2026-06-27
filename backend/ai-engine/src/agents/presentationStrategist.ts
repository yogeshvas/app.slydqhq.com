import { openAIClient } from "../config/ai.client";
import { STRATEGIST_PROMPT } from "../constants/fineprompt";
import type { DeckType } from "../config/deckTypes";

export const presentationStrategist = async (userInput: any, noOfSlides: number = 15, deckType: DeckType = "general") => {
    console.log("[presentationStrategist] building deck blueprint...");
    try {
        const prompt: string =
            userInput.prompt ??
            // legacy field fallback so old integrations don't break
            [
                userInput.topic ?? userInput.productName,
                userInput.presentationType ? `Type: ${userInput.presentationType}` : null,
                userInput.audience ? `Audience: ${userInput.audience}` : null,
                userInput.context ?? userInput.companyDescription ?? userInput.clientContext,
                userInput.organizationName ?? userInput.companyName
                    ? `Organization: ${userInput.organizationName ?? userInput.companyName}`
                    : null,
                Array.isArray(userInput.keyPoints) && userInput.keyPoints.length
                    ? `Key points: ${userInput.keyPoints.join(", ")}`
                    : null,
            ]
                .filter(Boolean)
                .join(". ");

        const response = await openAIClient.responses.create({
            model: "gpt-5-nano",
            reasoning: { effort: "minimal" },
            instructions: STRATEGIST_PROMPT,
            input: `Return JSON.\n${JSON.stringify({ noOfSlides, prompt, deckType })}`,
            text: { format: { type: "json_object" } },
        });

        return JSON.parse(response.output_text);
    } catch (error: any) {
        console.error("[presentationStrategist]", error?.message ?? error);
        throw error;
    }
};
