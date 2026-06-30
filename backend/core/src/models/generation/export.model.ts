import { defineModel, ref } from "../_base";

export const Export = defineModel("Export", {
  deckId: ref("Deck"),
  workspaceId: ref("Workspace"),

  format: {
    type: String,
    enum: ["pdf", "pptx", "gslides"],
    required: true,
  },

  status: {
    type: String,
    enum: ["pending", "ready", "error"],
    default: "pending",
  },

  // The generated file in object storage (set once status is "ready").
  assetId: ref("Asset", false),
  requestedBy: ref("User"),
});
