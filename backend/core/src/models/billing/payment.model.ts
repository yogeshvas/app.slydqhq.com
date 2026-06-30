import { defineModel, ref } from "../_base";

export const Payment = defineModel("Payment", {
  workspaceId: ref("Workspace"),

  provider: { type: String, default: "razorpay" },
  // Razorpay order id (recharge) and the captured payment id.
  gatewayOrderId: { type: String },
  gatewayPaymentId: { type: String },
  // Idempotency guard — unique so webhook retries never double-credit.
  idempotencyKey: { type: String, unique: true, sparse: true },

  // Whole currency units (e.g. 199 = ₹199 / $1.99 depending on `currency`).
  amount: { type: Number, required: true },
  currency: { type: String, default: "INR" },

  status: {
    type: String,
    enum: ["created", "paid", "failed", "refunded"],
    default: "created",
  },

  // Credits this payment added to the ledger.
  creditsGranted: { type: Number, default: 0 },
  // What was bought: a recharge pack id, or "pro_subscription".
  kind: { type: String },
});

Payment.schema.index({ workspaceId: 1, createdAt: -1 });
