import { defineModel, ref } from "../_base";

export const Template = defineModel("Template", {
  name: { type: String, required: true },
  slug: { type: String, required: true },

  // System templates ship with the product; workspace templates are user-saved.
  scope: {
    type: String,
    enum: ["system", "workspace"],
    default: "system",
  },
  // Null for system templates; set for workspace-scoped custom presets.
  workspaceId: ref("Workspace", false),

  // The preset itself: deckType × theme × accent × canvas.
  deckType: { type: String, required: true },
  theme: { type: String, required: true },
  accentColor: {
    name: { type: String },
    hex: { type: String },
  },
  canvas: { type: String, required: true },

  coverThumbnailUrl: { type: String, default: "" },

  tier: {
    type: String,
    enum: ["free", "premium"],
    default: "free",
  },
});

Template.schema.index({ slug: 1 }, { unique: true });
// Gallery: list system templates, or a workspace's own.
Template.schema.index({ scope: 1, workspaceId: 1 });
