import { defineModel, ObjectId, ref } from "../_base";

export const Deck = defineModel("Deck", {
  // Decks belong to a workspace, not a user (teams); authorId is who created it.
  workspaceId: ref("Workspace"),
  authorId: ref("User"),

  title: { type: String, required: true },

  // One-sentence core narrative the engine emits at outline time — kept so AI
  // edits ("Ask AI") have the deck's topic/context, not just one slide's content.
  storyTheme: { type: String, default: "" },

  // Deck-shaping inputs — mirror the ai-engine config primitives. Kept as plain
  // strings (not enums) so the engine stays the single source of truth for valid
  // deckType / theme / canvas values.
  deckType: { type: String, required: true },
  theme: { type: String, required: true },
  accentColor: {
    name: { type: String },
    hex: { type: String },
  },
  canvas: { type: String, required: true },

  // Preset this deck was instantiated from (optional — decks can be generated ad hoc).
  templateId: ref("Template", false),

  // Folder this deck is filed under (optional — null = unfiled).
  folderId: ref("Folder", false),

  // Ordered list of slideIds — cheap reordering touches only this array.
  slideOrder: { type: [ObjectId], ref: "Slide", default: [] },

  status: {
    type: String,
    enum: ["draft", "generating", "ready", "archived"],
    default: "draft",
  },

  thumbnailUrl: { type: String, default: "" },

  // Anonymous opens via the public share link (logged-in views live in DeckView).
  publicViewCount: { type: Number, default: 0 },

  // Shared stylesheet the ai-engine emits once per deck; every slide's cached
  // `html` fragment needs it, so the viewer can render saved decks standalone.
  styleCss: { type: String, default: "" },

  // Soft-delete — decks are recoverable, not hard-deleted.
  deletedAt: { type: Date, default: null },
});

// List a workspace's live decks, newest first.
Deck.schema.index({ workspaceId: 1, deletedAt: 1, updatedAt: -1 });
