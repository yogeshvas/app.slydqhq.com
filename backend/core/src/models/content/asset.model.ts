import { defineModel, ref } from "../_base";

export const Asset = defineModel("Asset", {
  workspaceId: ref("Workspace"),
  // Who added it (uploader, or the user whose generation produced it).
  authorId: ref("User", false),

  type: {
    type: String,
    enum: ["image", "pdf", "pptx"],
    required: true,
    default: "image",
  },

  // Public URL the image is served from. For uploads this is the R2/CDN URL; for
  // AI/stock it's the engine/Unsplash URL. Mongo never stores the blob itself.
  url: { type: String, required: true },
  // Object-storage key (set for uploads) so we can delete the blob later.
  storageKey: { type: String },

  source: {
    type: String,
    enum: ["unsplash", "ai", "upload", "export"],
    required: true,
  },

  // ── Searchable metadata ──────────────────────────────────────────────────
  // A short human title + description, derived by AI (vision) for AI/stock/upload
  // images so users can search by what's actually in the picture.
  title: { type: String, default: "" },
  description: { type: String, default: "" },
  // User-added tags (editable) kept separate from AI-suggested tags so a user
  // edit never gets clobbered when AI metadata is (re)generated.
  tags: { type: [String], default: [], index: true },
  aiTags: { type: [String], default: [] },

  // Lifecycle of the AI metadata enrichment (async, best-effort).
  metaStatus: {
    type: String,
    enum: ["pending", "ready", "failed"],
    default: "pending",
  },

  mime: { type: String },
  width: { type: Number },
  height: { type: Number },
  bytes: { type: Number },
  originalFilename: { type: String },

  // Where it first appeared (for provenance / "used in" later). Optional.
  deckId: ref("Deck", false),
  slideId: ref("Slide", false),

  // Provenance — e.g. the AI prompt or the Unsplash photo id.
  meta: {
    prompt: { type: String },
    unsplashId: { type: String },
  },
});

// A workspace's assets, newest first — the default library listing.
Asset.schema.index({ workspaceId: 1, createdAt: -1 });
// Tab filtering (source) within a workspace, newest first.
Asset.schema.index({ workspaceId: 1, source: 1, createdAt: -1 });
// Dedupe / "already in library?" lookups by URL within a workspace.
Asset.schema.index({ workspaceId: 1, url: 1 });
// Full-text search over the human + AI metadata. Weighted so a title/tag match
// ranks above a description/prompt match. One text index per collection (Mongo).
Asset.schema.index(
  {
    title: "text",
    tags: "text",
    aiTags: "text",
    description: "text",
    "meta.prompt": "text",
    originalFilename: "text",
  },
  {
    weights: { title: 10, tags: 8, aiTags: 5, description: 3, "meta.prompt": 2, originalFilename: 1 },
    name: "asset_search_text",
  },
);
