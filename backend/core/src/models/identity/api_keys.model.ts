import mongoose from "mongoose";
import { defineModel, ref } from "../_base";

export const ApiKey = defineModel("ApiKey", {
  workspaceId: ref("Workspace"),
  name: {
    type: String,
    required: true,
  },
  hashedKey: {
    type: String,
    required: true,
    unique: true,
  },
  prefix: {
    type: String,
    required: true,
  },
  scopes: {
    type: [String],
    default: [],
  },

  // Optional per-key credit cap (null = uncapped; only the workspace wallet limits).
  budgetCredits: { type: Number, default: null },
  // Running total of credits this key has spent (for budget enforcement + display).
  spentCredits: { type: Number, default: 0 },
  // Soft on/off without revoking (revoke is permanent).
  enabled: { type: Boolean, default: true },

  lastUsedAt: {
    type: Date,
    default: null,
  },
  createdBy: ref("User"),
  revokedAt: {
    type: Date,
    default: null,
  },
});

// Auth lookups are by hashedKey (already unique); also list a workspace's keys.
ApiKey.schema.index({ workspaceId: 1, createdAt: -1 });
