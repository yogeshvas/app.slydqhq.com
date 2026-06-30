import mongoose from "mongoose";
import { defineModel } from "../_base";

export const Plan = defineModel("Plan", {
  name: { type: String, required: true },

  stripePriceId: { type: String },
  monthlyCredits: { type: Number, default: 0 },
  seats: { type: Number, default: 1 },

  // Feature flags — { premiumTemplates, pptxExport, … }. Mixed so flags can be
  // added without a schema change.
  features: { type: mongoose.Schema.Types.Mixed, default: {} },

  priceCents: { type: Number, default: 0 },
  interval: {
    type: String,
    enum: ["month", "year"],
    default: "month",
  },
});
