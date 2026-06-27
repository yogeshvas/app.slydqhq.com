import mongoose from "mongoose";

const workspaceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    slug: {
      type: String,
      unique: true,
      required: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    avatar: {
      type: String,
    },
    plan: {
      type: String,
      default: "free",
    },
  },
  { timestamps: true },
);

export const Workspace = mongoose.model("Workspace", workspaceSchema);
