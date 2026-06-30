import type { Request, Response } from "express";
import asyncHandler from "../middleware/asyncHandler";
import ApiResponse from "../responses/apiResponse";
import { getCurrentWorkspace } from "../services/workspace.service";
import {
  cancelProSubscription,
  createProSubscription,
  createRecharge,
  getCatalog,
  getInvoices,
  getLedger,
  getWallet,
  handleWebhookEvent,
} from "../services/billing.service";
import { verifyWebhookSignature } from "../services/razorpay.client";
import ApiError from "../utils/appError";
import { logger } from "../utils/logger";

/** GET /billing/plans — plans + recharge packs in the workspace currency. */
export const getPlans = asyncHandler(async (req: Request, res: Response) => {
  const workspace = await getCurrentWorkspace(req.auth!.id);
  const catalog = await getCatalog(workspace.id);
  return ApiResponse.success(res, catalog, "Plans loaded.");
});

/** GET /billing/wallet — balance + plan + renewal. */
export const getWalletController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspace = await getCurrentWorkspace(req.auth!.id);
    const wallet = await getWallet(workspace.id);
    return ApiResponse.success(res, wallet, "Wallet loaded.");
  },
);

/** GET /billing/ledger — transaction history. */
export const getLedgerController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspace = await getCurrentWorkspace(req.auth!.id);
    const { page } = req.query as { page?: string };
    const ledger = await getLedger(workspace.id, page ? Number(page) : 1);
    return ApiResponse.success(res, ledger, "Ledger loaded.");
  },
);

/** GET /billing/invoices — paid invoices (recharges + subscription charges). */
export const getInvoicesController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspace = await getCurrentWorkspace(req.auth!.id);
    const invoices = await getInvoices(workspace.id);
    return ApiResponse.success(res, { invoices }, "Invoices loaded.");
  },
);

/** POST /billing/recharge — create a Razorpay order for a credit pack. */
export const recharge = asyncHandler(async (req: Request, res: Response) => {
  const workspace = await getCurrentWorkspace(req.auth!.id);
  const { packId } = req.body as { packId: string };
  const order = await createRecharge(workspace.id, packId);
  return ApiResponse.success(res, order, "Recharge order created.");
});

/** POST /billing/subscribe — create a Razorpay Pro subscription. */
export const subscribe = asyncHandler(async (req: Request, res: Response) => {
  const workspace = await getCurrentWorkspace(req.auth!.id);
  const sub = await createProSubscription(workspace.id);
  return ApiResponse.success(res, sub, "Subscription created.");
});

/** POST /billing/cancel — cancel Pro at period end. */
export const cancel = asyncHandler(async (req: Request, res: Response) => {
  const workspace = await getCurrentWorkspace(req.auth!.id);
  const result = await cancelProSubscription(workspace.id);
  return ApiResponse.success(res, result, "Subscription will cancel at period end.");
});

/**
 * POST /billing/webhook — Razorpay events. Unauthenticated; verified by signature
 * over the RAW request body. Always 200s quickly so Razorpay doesn't retry-storm.
 */
export const webhook = asyncHandler(async (req: Request, res: Response) => {
  const signature = req.header("x-razorpay-signature") ?? "";
  const raw = (req as any).rawBody as Buffer | undefined;
  const rawStr = raw ? raw.toString("utf8") : JSON.stringify(req.body);

  if (!verifyWebhookSignature(rawStr, signature)) {
    logger.warn("Razorpay webhook signature verification failed");
    throw ApiError.badRequest("Invalid webhook signature.");
  }

  try {
    await handleWebhookEvent(req.body);
  } catch (err) {
    logger.error({ err }, "Razorpay webhook handling failed");
    // Still ack 200 — logged; idempotency covers any Razorpay retry.
  }
  return ApiResponse.success(res, { ok: true }, "Webhook received.");
});
