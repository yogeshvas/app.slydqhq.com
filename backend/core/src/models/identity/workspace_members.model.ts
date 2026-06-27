import mongoose from "mongoose";
import { defineModel } from "../_base";

export const WorkspaceMember = defineModel("WorkspaceMember", {
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Workspace",
    required: true,
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  role: {
    type: String,
    enum: ["owner", "admin", "editor", "viewer"],
    default: "viewer",
  },
  status: { type: String, enum: ["active", "invited"], default: "active" },
});
