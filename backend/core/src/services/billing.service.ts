import { Workspace } from "../models/identity/workspace.model";
import { Payment } from "../models/billing/payment.model";
import { Subscription } from "../models/billing/subscription.model";
import { CreditLedger } from "../models/billing/credit_ledger.model";
import { env } from "../config/env";
import {
  CREDIT_UNIT_PRICE,
  PLANS,
  RECHARGE_PACKS,
  findPack,
  type Currency,
} from "../config/pricing";
import ApiError from "../utils/appError";
import { logger } from "../utils/logger";
import { getBalance, grantCredits } from "./credit.service";
import {
  cancelSubscription,
  createOrder,
  createSubscription,
  isRazorpayConfigured,
} from "./razorpay.client";

async function workspaceCurrency(workspaceId: unknown): Promise<Currency> {
  const ws: any = await Workspace.findById(workspaceId).lean();
  return (ws?.currency as Currency) ?? "INR";
}

/** Plans + recharge packs priced in the workspace's currency (for the pricing UI). */
export async function getCatalog(workspaceId: unknown) {
  const currency = await workspaceCurrency(workspaceId);
  return {
    currency,
    creditUnitPrice: CREDIT_UNIT_PRICE[currency],
    packs: RECHARGE_PACKS.map((p) => ({
      id: p.id,
      credits: p.credits,
      price: p.price[currency],
      bonusPct: p.bonusPct,
    })),
    plans: Object.values(PLANS).map((p) => ({
      tier: p.tier,
      name: p.name,
      price: p.price[currency],
      monthlyCredits: p.monthlyCredits,
      cardsPerPrompt: p.cardsPerPrompt,
      features: p.features,
    })),
  };
}

/** Wallet snapshot: balance, plan, currency, and whether billing is live. */
export async function getWallet(workspaceId: unknown) {
  const ws: any = await Workspace.findById(workspaceId).lean();
  if (!ws) throw ApiError.notFound("Workspace not found.");
  const balance = await getBalance(workspaceId);
  const sub: any = await Subscription.findOne({ workspaceId }).lean();
  return {
    balance,
    plan: ws.plan ?? "free",
    currency: ws.currency ?? "INR",
    billingEnabled: isRazorpayConfigured(),
    renewsAt: sub?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
  };
}

/** Paid invoices (recharges + subscription charges) for the workspace, newest first. */
export async function getInvoices(workspaceId: unknown) {
  const payments = await Payment.find({ workspaceId, status: "paid" })
    .sort({ createdAt: -1 })
    .lean();
  return payments.map((p: any) => ({
    _id: String(p._id),
    invoiceNo: `INV-${String(p._id).slice(-8).toUpperCase()}`,
    amount: p.amount,
    currency: p.currency,
    credits: p.creditsGranted,
    kind: p.kind, // pack id or "subscription"
    gatewayPaymentId: p.gatewayPaymentId ?? "",
    createdAt: p.createdAt,
  }));
}

/** Paginated transaction history (the ledger view). */
export async function getLedger(workspaceId: unknown, page = 1, limit = 30) {
  const skip = (Math.max(page, 1) - 1) * limit;
  const [items, total] = await Promise.all([
    CreditLedger.find({ workspaceId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CreditLedger.countDocuments({ workspaceId }),
  ]);
  return {
    items: items.map((e: any) => ({
      _id: String(e._id),
      delta: e.delta,
      reason: e.reason,
      balanceAfter: e.balanceAfter,
      kind: e.kind,
      createdAt: e.createdAt,
    })),
    total,
    page,
    hasMore: page * limit < total,
  };
}

/** Create a Razorpay order for a recharge pack. Returns checkout params. */
export async function createRecharge(workspaceId: unknown, packId: string) {
  const pack = findPack(packId);
  if (!pack) throw ApiError.badRequest("Unknown recharge pack.");
  const currency = await workspaceCurrency(workspaceId);
  const amountMinor = Math.round(pack.price[currency] * 100); // paise / cents

  const order = await createOrder(amountMinor, currency, {
    workspaceId: String(workspaceId),
    packId,
    credits: String(pack.credits),
  });

  await Payment.create({
    workspaceId,
    provider: "razorpay",
    gatewayOrderId: order.id,
    amount: pack.price[currency],
    currency,
    status: "created",
    creditsGranted: pack.credits,
    kind: packId,
  });

  return {
    orderId: order.id,
    amount: amountMinor,
    currency,
    keyId: env.RAZORPAY_KEY_ID,
    credits: pack.credits,
  };
}

/** Create a Razorpay subscription for the Pro plan. */
export async function createProSubscription(workspaceId: unknown) {
  const currency = await workspaceCurrency(workspaceId);
  const planId =
    currency === "USD" ? env.RAZORPAY_PRO_PLAN_ID_USD : env.RAZORPAY_PRO_PLAN_ID_INR;
  if (!planId) {
    throw ApiError.serviceUnavailable(
      "The Pro plan isn't configured for this currency yet.",
    );
  }
  const sub = await createSubscription(planId, {
    workspaceId: String(workspaceId),
  });

  await Subscription.findOneAndUpdate(
    { workspaceId },
    {
      workspaceId,
      provider: "razorpay",
      tier: "pro",
      gatewaySubscriptionId: sub.id,
      gatewayPlanId: planId,
      status: "created",
    },
    { upsert: true },
  );

  return { subscriptionId: sub.id, keyId: env.RAZORPAY_KEY_ID, shortUrl: sub.short_url };
}

/** Cancel the workspace's Pro subscription at period end. */
export async function cancelProSubscription(workspaceId: unknown) {
  const sub: any = await Subscription.findOne({ workspaceId });
  if (!sub?.gatewaySubscriptionId) throw ApiError.notFound("No active subscription.");
  await cancelSubscription(sub.gatewaySubscriptionId, true);
  sub.cancelAtPeriodEnd = true;
  await sub.save();
  return { ok: true };
}

// ── Webhook handling (idempotent) ────────────────────────────────────────────

/**
 * Grant credits exactly once for a given idempotency key (e.g. a Razorpay payment
 * id). The unique key on Payment.idempotencyKey is the guard: if the insert hits a
 * duplicate, this event was already processed → skip the grant.
 */
async function grantMonthlyOnce(
  workspaceId: unknown,
  credits: number,
  idempotencyKey: string,
  expiresAt: Date,
): Promise<void> {
  try {
    await Payment.create({
      workspaceId,
      provider: "razorpay",
      idempotencyKey,
      amount: 0,
      currency: "INR",
      status: "paid",
      creditsGranted: credits,
      kind: "subscription",
    });
  } catch (err: any) {
    if (err?.code === 11000) return; // already processed this charge
    throw err;
  }
  await grantCredits(workspaceId, credits, "subscription", {
    kind: "expiring",
    expiresAt,
  });
}

/**
 * Handle a verified Razorpay webhook event. Recharge → grant pack credits; Pro
 * subscription charged → grant monthly credits; subscription lifecycle → flip plan.
 */
export async function handleWebhookEvent(event: any): Promise<void> {
  const type: string = event?.event ?? "";

  if (type === "payment.captured" || type === "order.paid") {
    const payment = event.payload?.payment?.entity;
    const orderId = payment?.order_id;
    if (!orderId) return;
    const record: any = await Payment.findOne({ gatewayOrderId: orderId });
    if (!record || record.status === "paid") return; // unknown or already done
    record.status = "paid";
    record.gatewayPaymentId = payment.id;
    await record.save();
    // Recharge credits are permanent (never expire).
    await grantCredits(record.workspaceId, record.creditsGranted, "recharge", {
      kind: "permanent",
      refId: record._id,
    });
    logger.info(
      { workspaceId: record.workspaceId, credits: record.creditsGranted },
      "recharge credited",
    );
    return;
  }

  if (type === "subscription.charged") {
    const sub = event.payload?.subscription?.entity;
    const payment = event.payload?.payment?.entity;
    const workspaceId = sub?.notes?.workspaceId;
    if (!workspaceId) return;
    const monthly = PLANS.pro.monthlyCredits;
    const expiresAt = new Date(Date.now() + 32 * 24 * 60 * 60 * 1000);
    // Idempotent per charge (Razorpay payment id is unique per cycle).
    await grantMonthlyOnce(
      workspaceId,
      monthly,
      `subc_${payment?.id ?? sub?.id}`,
      expiresAt,
    );
    await Subscription.updateOne(
      { gatewaySubscriptionId: sub.id },
      {
        status: "active",
        currentPeriodEnd: sub?.current_end
          ? new Date(sub.current_end * 1000)
          : expiresAt,
      },
    );
    await Workspace.updateOne({ _id: workspaceId }, { plan: "pro" });
    return;
  }

  if (type === "subscription.activated") {
    const sub = event.payload?.subscription?.entity;
    const workspaceId = sub?.notes?.workspaceId;
    if (workspaceId) {
      await Subscription.updateOne(
        { gatewaySubscriptionId: sub.id },
        { status: "active" },
      );
      await Workspace.updateOne({ _id: workspaceId }, { plan: "pro" });
    }
    return;
  }

  if (type === "subscription.cancelled" || type === "subscription.halted") {
    const sub = event.payload?.subscription?.entity;
    const workspaceId = sub?.notes?.workspaceId;
    if (workspaceId) {
      await Subscription.updateOne(
        { gatewaySubscriptionId: sub.id },
        { status: type === "subscription.halted" ? "halted" : "canceled" },
      );
      await Workspace.updateOne({ _id: workspaceId }, { plan: "free" });
    }
    return;
  }
}
