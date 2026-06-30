import mongoose from "mongoose";
import { defineModel, ref } from "../_base";

export const SlideVersion = defineModel("SlideVersion", {
  slideId: ref("Slide"),
  deckId: ref("Deck"),

  // Point-in-time snapshot of the slide — enough to diff or restore on its own.
  snapshot: {
    content: { type: mongoose.Schema.Types.Mixed, default: {} },
    html: { type: String, default: "" },
    layout: { type: String },
  },

  // Who/what produced this version. editedBy is null for AI-generated versions.
  editedBy: ref("User", false),
  source: {
    type: String,
    enum: ["ai", "user", "regenerate"],
    required: true,
  },
});

// A slide's version history, newest first.
SlideVersion.schema.index({ slideId: 1, createdAt: -1 });
