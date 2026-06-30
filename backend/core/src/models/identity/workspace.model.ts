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
      enum: ["free", "pro"],
      default: "free",
    },
    // Billing currency, fixed at signup ("INR" for India, else "USD").
    currency: {
      type: String,
      enum: ["INR", "USD"],
      default: "INR",
    },
    // Last calendar day (YYYY-MM-DD) the free-tier new-day top-up was applied.
    lastTopupDate: {
      type: String,
      default: "",
    },
  },
  { timestamps: true },
);

export const Workspace = mongoose.model("Workspace", workspaceSchema);
