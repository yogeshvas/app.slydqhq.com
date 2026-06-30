import { defineModel, ref } from "../_base";

/**
 * A generated, editable deck outline (titles + bullets), saved BEFORE any deck is
 * created or credits charged. Persisting it lets the review page show the last
 * outline again without re-calling the model — saving tokens — and survives
 * reloads across sessions/devices.
 */
export const Outline = defineModel("Outline", {
  workspaceId: ref("Workspace"),
  authorId: ref("User"),

  prompt: { type: String, required: true },

  // Deck-shaping inputs captured at outline time (mirror the deck config).
  deckType: { type: String, default: "general" },
  theme: { type: String, default: "corporate" },
  canvas: { type: String, default: "widescreen_16_9" },
  accentColor: { type: String, default: "" },
  // The model the user picked in the UI (cosmetic for now — stored so the choice
  // is remembered; generation still runs on the engine's configured model).
  model: { type: String, default: "gpt-5-nano" },

  // The generated outline payload.
  deckTitle: { type: String, default: "" },
  storyTheme: { type: String, default: "" },
  // Strategist analysis from the outline agent (topicSummary, audience, etc.).
  analysis: { type: Object },
  slides: {
    type: [
      {
        slideNumber: { type: Number },
        title: { type: String },
        bullets: { type: [String], default: [] },
        // Semantic role (cover, business_impact…) — steers layout choice on generate.
        slideType: { type: String, default: "" },
      },
    ],
    default: [],
  },
});

// Fetch a workspace's most recent outline.
Outline.schema.index({ workspaceId: 1, updatedAt: -1 });
