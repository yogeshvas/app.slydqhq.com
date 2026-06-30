import { CreditLedger } from "../models/billing/credit_ledger.model";
import type { CreditKind } from "../config/pricing";
import ApiError from "../utils/appError";

// Spends: deck generation, AI image, AI edit, export. Grants: signup, daily
// top-up, subscription bundle, recharge, refund (and legacy grant/purchase).
type LedgerReason =
  | "grant"
  | "signup"
  | "daily_topup"
  | "subscription"
  | "recharge"
  | "referral"
  | "purchase"
  | "generation"
  | "ai_image"
  | "ai_edit"
  | "export"
  | "refund";

/** Current balance = the most recent ledger entry's running snapshot. */
export async function getBalance(workspaceId: unknown): Promise<number> {
  const latest = await CreditLedger.findOne({ workspaceId })
    .sort({ createdAt: -1 })
    .lean();
  return (latest?.balanceAfter as number | undefined) ?? 0;
}

/**
 * Append a ledger entry (append-only — never mutate rows). `delta` is signed:
 * positive to grant/refund/recharge, negative to charge. Throws if a charge would
 * push the balance below zero. `kind`/`expiresAt` mark expiring (granted) vs
 * permanent (purchased) credits for reporting/spend-order.
 */
export async function recordCredit(
  workspaceId: unknown,
  delta: number,
  reason: LedgerReason,
  refId?: unknown,
  opts: { kind?: CreditKind; expiresAt?: Date | null } = {},
): Promise<number> {
  const balance = await getBalance(workspaceId);
  const balanceAfter = balance + delta;

  if (balanceAfter < 0) {
    throw ApiError.badRequest(
      "Not enough credits. Top up your wallet to keep generating.",
    );
  }

  await CreditLedger.create({
    workspaceId,
    delta,
    reason,
    refId,
    balanceAfter,
    kind: opts.kind ?? (delta > 0 ? "permanent" : "expiring"),
    expiresAt: opts.expiresAt ?? null,
  });

  return balanceAfter;
}

/** Convenience: grant credits (positive). */
export function grantCredits(
  workspaceId: unknown,
  amount: number,
  reason: LedgerReason,
  opts: { kind?: CreditKind; expiresAt?: Date | null; refId?: unknown } = {},
): Promise<number> {
  return recordCredit(workspaceId, Math.abs(amount), reason, opts.refId, {
    kind: opts.kind,
    expiresAt: opts.expiresAt,
  });
}

/** Convenience: charge credits (negative). Throws if balance insufficient. */
export function chargeCredits(
  workspaceId: unknown,
  amount: number,
  reason: LedgerReason,
  refId?: unknown,
): Promise<number> {
  return recordCredit(workspaceId, -Math.abs(amount), reason, refId);
}
