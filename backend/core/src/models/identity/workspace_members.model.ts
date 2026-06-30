import mongoose from "mongoose";
import { defineModel } from "../_base";

export const WorkspaceMember = defineModel("WorkspaceMember", {
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Workspace",
    required: true,
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  // Flat access model: owner & admin manage members; member has full edit access
  // to the workspace's decks/media/generation. (No view-only tier.)
  role: {
    type: String,
    enum: ["owner", "admin", "member"],
    default: "member",
  },
  status: { type: String, enum: ["active", "invited"], default: "active" },
});

// One membership row per (workspace, user).
WorkspaceMember.schema.index({ workspaceId: 1, userId: 1 }, { unique: true });
