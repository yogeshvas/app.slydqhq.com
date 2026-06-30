import { defineModel, ref } from "../_base";

export const Subscription = defineModel("Subscription", {
  // One subscription per workspace.
  workspaceId: { ...ref("Workspace"), unique: true },

  provider: { type: String, default: "razorpay" },
  tier: { type: String, default: "pro" },
  gatewaySubscriptionId: { type: String },
  gatewayPlanId: { type: String },

  status: {
    type: String,
    enum: ["created", "active", "past_due", "canceled", "halted"],
    default: "created",
  },

  currentPeriodEnd: { type: Date },
  cancelAtPeriodEnd: { type: Boolean, default: false },
});
