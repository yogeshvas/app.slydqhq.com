import { defineModel, ref } from "../_base";

/**
 * Per-user view state for a deck: powers "Recently viewed", "who viewed" analytics,
 * and Favorites. One row per (deck, user) — upserted on each open.
 */
export const DeckView = defineModel("DeckView", {
  deckId: ref("Deck"),
  workspaceId: ref("Workspace"),
  userId: ref("User"),

  lastViewedAt: { type: Date, default: () => new Date() },
  viewCount: { type: Number, default: 0 },
  favorite: { type: Boolean, default: false },
});

// One view-state row per user per deck.
DeckView.schema.index({ deckId: 1, userId: 1 }, { unique: true });
// A user's recently-viewed / favorites within a workspace.
DeckView.schema.index({ workspaceId: 1, userId: 1, lastViewedAt: -1 });
DeckView.schema.index({ workspaceId: 1, userId: 1, favorite: 1 });
