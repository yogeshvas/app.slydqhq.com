import { defineModel, ref } from "../_base";

/**
 * One row per successful referral (the new user signed up with someone's code).
 * Drives the referrer's monthly cap + the "friends joined / credits earned" stats.
 */
export const Referral = defineModel("Referral", {
  referrerId: ref("User"),
  refereeId: ref("User"),

  // Credits actually granted to each side (referrer may be 0 if the cap was hit).
  referrerReward: { type: Number, default: 0 },
  refereeReward: { type: Number, default: 0 },
  // Whether the referrer was paid (false when the monthly cap was exceeded).
  referrerRewarded: { type: Boolean, default: false },
});

// One referral per referee (a user can only be referred once).
Referral.schema.index({ refereeId: 1 }, { unique: true });
// A referrer's referrals over time (for the monthly cap + stats).
Referral.schema.index({ referrerId: 1, createdAt: -1 });
