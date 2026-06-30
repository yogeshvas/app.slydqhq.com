import crypto from "crypto";
import { User } from "../models/identity/user.model";
import { Referral } from "../models/billing/referral.model";
import { env } from "../config/env";
import {
  REFERRAL_CLAIM_WINDOW_MS,
  REFERRAL_MONTHLY_CAP,
  REFERRAL_REFEREE_REWARD,
  REFERRAL_REFERRER_REWARD,
} from "../config/pricing";
import ApiError from "../utils/appError";
import { logger } from "../utils/logger";
import { grantCredits } from "./credit.service";

/** Generate a short, unambiguous, unique referral code (e.g. "SLYDE-7KQ2"). */
async function uniqueCode(): Promise<string> {
  for (let i = 0; i < 6; i++) {
    const code = `SLY${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    if (!(await User.exists({ referralCode: code }))) return code;
  }
  // Extremely unlikely fallback.
  return `SLY${Date.now().toString(36).toUpperCase()}`;
}

function referralLink(code: string): string {
  return `${env.FRONTEND_URL.replace(/\/$/, "")}/signup?ref=${code}`;
}

/** The signed-in user's referral code + link + stats (lazily creates the code). */
export async function getMyReferral(userId: string) {
  const user: any = await User.findById(userId);
  if (!user) throw ApiError.notFound("User not found.");
  if (!user.referralCode) {
    user.referralCode = await uniqueCode();
    await user.save();
  }

  const referrals = await Referral.find({ referrerId: userId }).lean();
  const creditsEarned = referrals.reduce(
    (sum, r: any) => sum + (r.referrerReward ?? 0),
    0,
  );
  // This calendar month's count (for the cap display).
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const thisMonth = referrals.filter(
    (r: any) => new Date(r.createdAt) >= monthStart,
  ).length;

  return {
    code: user.referralCode,
    link: referralLink(user.referralCode),
    friendsJoined: referrals.length,
    creditsEarned,
    thisMonth,
    monthlyCap: REFERRAL_MONTHLY_CAP,
    rewardPerReferral: REFERRAL_REFERRER_REWARD,
    refereeReward: REFERRAL_REFEREE_REWARD,
  };
}

/**
 * Attribute a referral for the signed-in (newly created) user. Idempotent and
 * abuse-guarded: only a brand-new account (within the claim window, not already
 * referred) can claim, never with one's own code. Grants the new user their
 * bonus, and the referrer their reward if under the monthly cap.
 */
export async function claimReferral(userId: string, rawCode: string) {
  const code = rawCode.trim().toUpperCase();
  const me: any = await User.findById(userId);
  if (!me) throw ApiError.notFound("User not found.");

  // Already referred, or account too old to claim → silent no-op (not an error,
  // so the client's fire-and-forget claim never surfaces a scary message).
  if (me.referredBy) return { claimed: false, reason: "already" };
  const ageMs = Date.now() - new Date(me.createdAt).getTime();
  if (ageMs > REFERRAL_CLAIM_WINDOW_MS) {
    return { claimed: false, reason: "window" };
  }

  const referrer: any = await User.findOne({ referralCode: code });
  if (!referrer || String(referrer._id) === String(me._id)) {
    return { claimed: false, reason: "invalid" };
  }

  // Referrer's monthly cap.
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthCount = await Referral.countDocuments({
    referrerId: referrer._id,
    createdAt: { $gte: monthStart },
  });
  const rewardReferrer = monthCount < REFERRAL_MONTHLY_CAP;

  // Link the new user.
  me.referredBy = referrer._id;
  await me.save();

  // Record first (unique index on refereeId guards against double-claim races).
  try {
    await Referral.create({
      referrerId: referrer._id,
      refereeId: me._id,
      referrerReward: rewardReferrer ? REFERRAL_REFERRER_REWARD : 0,
      refereeReward: REFERRAL_REFEREE_REWARD,
      referrerRewarded: rewardReferrer,
    });
  } catch (err: any) {
    if (err?.code === 11000) return { claimed: false, reason: "already" };
    throw err;
  }

  // Grant credits to both workspaces (best-effort on the referrer side).
  await grantCredits(me.defaultWorkspaceId, REFERRAL_REFEREE_REWARD, "referral", {
    kind: "permanent",
  });
  if (rewardReferrer) {
    await grantCredits(
      referrer.defaultWorkspaceId,
      REFERRAL_REFERRER_REWARD,
      "referral",
      { kind: "permanent" },
    ).catch((err) =>
      logger.warn({ err, referrer: referrer._id }, "referrer reward failed"),
    );
  }

  return { claimed: true, refereeReward: REFERRAL_REFEREE_REWARD };
}
