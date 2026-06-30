import mongoose from "mongoose";
import { defineModel, ref } from "../_base";

export const Slide = defineModel("Slide", {
  deckId: ref("Deck"),
  workspaceId: ref("Workspace"),

  // Fractional index — drag-reorder rewrites ONE slide's position, not the deck.
  position: { type: Number, required: true },

  // Human-facing 1..N number for display; position is the source of truth for order.
  slideNumber: { type: Number },

  layout: { type: String, required: true },
  title: { type: String, default: "" },

  // Speaker / presenter notes (shown in the editor + Present mode; not rendered
  // onto the slide itself).
  notes: { type: String, default: "" },

  // Layout-specific JSON produced by the slideCreationAgent (shape varies per layout).
  content: { type: mongoose.Schema.Types.Mixed, default: {} },

  // Rendered HTML fragment, cached for instant preview/export. Invalidate on edit.
  html: { type: String, default: "" },

  // The resolved image for this slide (Unsplash / AI / upload), if any.
  imageAssetId: ref("Asset", false),

  status: {
    type: String,
    enum: ["pending", "ready", "error"],
    default: "pending",
  },

  // Soft-delete — slides are recoverable, not hard-deleted.
  deletedAt: { type: Date, default: null },
});

// Fetch a deck's live slides in render order.
Slide.schema.index({ deckId: 1, deletedAt: 1, position: 1 });
