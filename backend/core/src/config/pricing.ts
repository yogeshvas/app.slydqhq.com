/**
 * Billing & credits — the single source of truth for the money system.
 * Pay-as-you-go credits + one optional monthly Pro subscription. Tune the knobs
 * here; nothing about pricing should be hardcoded elsewhere. See BILLING_PLAN.md.
 */

export type Currency = "INR" | "USD";
export const CURRENCIES: Currency[] = ["INR", "USD"];
export const DEFAULT_CURRENCY: Currency = "INR";

export type PlanTier = "free" | "pro";

// ── Credit costs per AI action (flat — NOT per slide) ────────────────────────
// Credits are shown ~5× the rupee figure so the wallet feels generous (₹199 → 500
// credits, not 100). The MONEY economics are unchanged — a credit is just a smaller
// unit (₹0.40 each). Tune the headline value by changing the numbers together with
// CREDIT_UNIT_PRICE; the ratio (credits ÷ price) is what must stay consistent.

/** Generating a deck costs this many credits regardless of card count (≈ ₹80). */
export const DECK_GENERATION_CREDITS = 200;
/** Regenerating/replacing a slide image with a fresh AI illustration (≈ ₹30). */
export const AI_IMAGE_CREDITS = 75;
/** One AI text edit / layout change on a slide (≈ ₹6). */
export const AI_EDIT_CREDITS = 15;

// ── Free tier grants ─────────────────────────────────────────────────────────
/** Credits a brand-new workspace receives on signup (≈ 2 decks). */
export const SIGNUP_GRANT_CREDITS = 400;
/** On a new calendar day, a free workspace is topped UP TO this (never above). */
export const FREE_DAILY_CAP = 400;

// ── Credit price (recharge) per currency ─────────────────────────────────────
/** Price of ONE credit when bought à la carte (packs give a bonus on top). */
export const CREDIT_UNIT_PRICE: Record<Currency, number> = {
  INR: 0.4, // ₹0.40 / credit  → ₹100 ≈ 250 credits
  USD: 0.005, // $0.005 / credit
};

export interface RechargePack {
  id: string;
  credits: number;
  price: Record<Currency, number>; // smallest unit handled at gateway layer
  bonusPct: number; // informational (already baked into `credits`)
}

/** Recharge packs — credits always read higher than the price (psychological). */
export const RECHARGE_PACKS: RechargePack[] = [
  { id: "starter", credits: 500, price: { INR: 199, USD: 2.49 }, bonusPct: 0 },
  { id: "popular", credits: 1375, price: { INR: 499, USD: 5.99 }, bonusPct: 10 },
  { id: "value", credits: 3000, price: { INR: 999, USD: 11.99 }, bonusPct: 20 },
  { id: "bulk", credits: 6500, price: { INR: 1999, USD: 24.99 }, bonusPct: 30 },
];

export function findPack(id: string): RechargePack | undefined {
  return RECHARGE_PACKS.find((p) => p.id === id);
}

// ── Plans ────────────────────────────────────────────────────────────────────
export interface PlanDef {
  tier: PlanTier;
  name: string;
  /** Monthly price per currency (0 for free). */
  price: Record<Currency, number>;
  /** Credits granted each billing month (0 for free — free uses grants/top-ups). */
  monthlyCredits: number;
  /** Max cards per generation prompt. */
  cardsPerPrompt: number;
  features: {
    members: boolean;
    api: boolean;
    emailGeneration: boolean;
    removeWatermark: boolean;
  };
}

export const PLANS: Record<PlanTier, PlanDef> = {
  free: {
    tier: "free",
    name: "Free",
    price: { INR: 0, USD: 0 },
    monthlyCredits: 0,
    cardsPerPrompt: 15,
    features: { members: false, api: false, emailGeneration: false, removeWatermark: false },
  },
  pro: {
    tier: "pro",
    name: "Pro",
    price: { INR: 749, USD: 9.99 },
    monthlyCredits: 2000,
    cardsPerPrompt: 60,
    features: { members: true, api: true, emailGeneration: true, removeWatermark: true },
  },
};

/** Ledger entry kinds: expiring credits (granted/monthly) are spent before permanent. */
export type CreditKind = "expiring" | "permanent";
