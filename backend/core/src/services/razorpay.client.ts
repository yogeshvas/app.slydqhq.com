import crypto from "crypto";
import { env } from "../config/env";
import ApiError from "../utils/appError";

/**
 * Minimal Razorpay client over the REST API (no SDK dependency). Orders for
 * one-time credit recharge, Subscriptions for the monthly Pro plan, and webhook
 * signature verification. Auth is HTTP Basic (key_id:key_secret).
 */

const API = "https://api.razorpay.com/v1";

export function isRazorpayConfigured(): boolean {
  return Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
}

function authHeader(): string {
  const token = Buffer.from(
    `${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`,
  ).toString("base64");
  return `Basic ${token}`;
}

async function call<T>(path: string, body: Record<string, unknown>): Promise<T> {
  if (!isRazorpayConfigured()) {
    throw ApiError.serviceUnavailable(
      "Payments aren't available yet — Razorpay isn't configured.",
    );
  }
  const resp = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(),
    },
    body: JSON.stringify(body),
  });
  const data: any = await resp.json().catch(() => null);
  if (!resp.ok) {
    throw ApiError.serviceUnavailable(
      data?.error?.description ?? "Payment gateway error. Please try again.",
    );
  }
  return data as T;
}

export interface RzpOrder {
  id: string;
  amount: number;
  currency: string;
}

/** Create a one-time order (amount in the currency's smallest unit: paise/cents). */
export function createOrder(
  amountMinor: number,
  currency: string,
  notes: Record<string, string>,
): Promise<RzpOrder> {
  return call<RzpOrder>("/orders", {
    amount: amountMinor,
    currency,
    notes,
    payment_capture: 1,
  });
}

export interface RzpSubscription {
  id: string;
  status: string;
  short_url?: string;
}

/** Create a subscription against a pre-created Razorpay plan. */
export function createSubscription(
  planId: string,
  notes: Record<string, string>,
): Promise<RzpSubscription> {
  return call<RzpSubscription>("/subscriptions", {
    plan_id: planId,
    total_count: 120, // up to 10 years of monthly cycles; cancel ends it
    customer_notify: 1,
    notes,
  });
}

/** Cancel a subscription (at cycle end by default). */
export function cancelSubscription(
  subscriptionId: string,
  atCycleEnd = true,
): Promise<RzpSubscription> {
  return call<RzpSubscription>(`/subscriptions/${subscriptionId}/cancel`, {
    cancel_at_cycle_end: atCycleEnd ? 1 : 0,
  });
}

/** Verify a webhook payload against the configured webhook secret. */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  if (!env.RAZORPAY_WEBHOOK_SECRET) return false;
  const expected = crypto
    .createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  // Constant-time compare.
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
