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
