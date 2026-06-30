import { defineModel, ref } from "../_base";

export const DeckShare = defineModel("DeckShare", {
  deckId: ref("Deck"),
  workspaceId: ref("Workspace"),

  // Set for a direct user share; null for a public-link share (uses token instead).
  sharedWithUserId: ref("User", false),
  token: { type: String },

  role: {
    type: String,
    enum: ["viewer", "editor"],
    default: "viewer",
  },

  // ── Public-link settings ──────────────────────────────────────────────────
  // Whether the public link is live. Toggling off makes the token 404.
  enabled: { type: Boolean, default: true },
  // Optional view password (hashed with Bun.password — never stored in plaintext).
  passwordHash: { type: String, default: null },
  // Whether public viewers may download/export the deck.
  allowDownload: { type: Boolean, default: false },
  // Whether the deck may be surfaced/indexed publicly (listing/SEO hint).
  discoverable: { type: Boolean, default: false },

  expiresAt: { type: Date, default: null },
});

// Public-link lookups by token; sparse since direct shares have no token.
DeckShare.schema.index({ token: 1 }, { unique: true, sparse: true });
// All shares on a deck.
DeckShare.schema.index({ deckId: 1 });
