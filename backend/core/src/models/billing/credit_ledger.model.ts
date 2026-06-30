import { defineModel, ObjectId, ref } from "../_base";

// Append-only. Balance = sum of all `delta` entries — NEVER mutate a row.
// Refunds are new positive entries, not edits.
export const CreditLedger = defineModel("CreditLedger", {
  workspaceId: ref("Workspace"),

  // Signed: positive grants/top-ups/purchases, negative spends.
  delta: { type: Number, required: true },

  reason: {
    type: String,
    enum: [
      "grant", // legacy starter grant
      "signup", // new-workspace signup grant
      "daily_topup", // free-tier new-day top-up
      "subscription", // Pro monthly credit bundle
      "recharge", // wallet top-up via Razorpay
      "referral", // referral reward (referrer or new user)
      "purchase", // legacy purchase
      "generation", // −deck generation
      "ai_image", // −AI illustration
      "ai_edit", // −AI edit
      "export", // −export (if ever charged)
      "refund", // +refund on failure
    ],
    required: true,
  },

  // Expiring credits (granted/monthly/topup) are spent before permanent (recharge).
  kind: { type: String, enum: ["expiring", "permanent"], default: "permanent" },
  // When expiring credits lapse (null = never).
  expiresAt: { type: Date, default: null },

  // The jobId / paymentId that caused this entry (loose ref — varies by reason).
  refId: { type: ObjectId },

  // Running balance snapshot for fast reads / auditing.
  balanceAfter: { type: Number, required: true },
});

// A workspace's ledger in append order — newest entry gives current balance.
CreditLedger.schema.index({ workspaceId: 1, createdAt: -1 });
