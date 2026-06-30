import mongoose from "mongoose";
import { defineModel, ref } from "../_base";

export const Job = defineModel("Job", {
  deckId: ref("Deck"),
  workspaceId: ref("Workspace"),
  userId: ref("User"),

  type: {
    type: String,
    enum: ["generate", "regenerate_slide"],
    default: "generate",
  },

  prompt: { type: String },
  // Generation params: { noOfSlides, templateId, overrides… } — shape varies.
  params: { type: mongoose.Schema.Types.Mixed, default: {} },

  status: {
    type: String,
    enum: ["queued", "streaming", "done", "error"],
    default: "queued",
  },

  // Lets a dropped SSE client reconnect and see how far the run got.
  progress: {
    total: { type: Number, default: 0 },
    completed: { type: Number, default: 0 },
  },

  error: { type: String, default: null },
  creditsCharged: { type: Number, default: 0 },

  startedAt: { type: Date, default: null },
  finishedAt: { type: Date, default: null },
});

// Jobs for a deck, and a workspace's recent runs by status.
Job.schema.index({ deckId: 1 });
Job.schema.index({ workspaceId: 1, status: 1, createdAt: -1 });
