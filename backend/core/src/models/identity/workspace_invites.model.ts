import mongoose from "mongoose";
import { defineModel, ref } from "../_base";

export const WorkspaceInvites = defineModel("WorkspaceInvites", {
  workspaceId: ref("Workspace"),
  email: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ["admin", "editor", "viewer"],
    default: "viewer",
  },
  token: {
    type: String,
    unique: true,
    required: true,
  },
  invitedBy: ref("User"),
  expiresAt: {
    type: Date,
    required: true,
  },
  acceptedAt: {
    type: Date,
    default: null,
  },
});
