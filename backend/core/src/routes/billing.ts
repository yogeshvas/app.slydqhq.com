import express from "express";
import { requireAuth } from "../middleware/requireAuth";
import { validate } from "../middleware/validate";
import {
  cancel,
  getInvoicesController,
  getLedgerController,
  getPlans,
  getWalletController,
  recharge,
  subscribe,
  webhook,
} from "../controllers/billing.controller";
import { ledgerSchema, rechargeSchema } from "../validators/billing.validator";

const router = express.Router();

// Razorpay calls this — NO auth (verified by signature in the controller).
router.post("/webhook", webhook);

router.get("/plans", requireAuth, getPlans);
router.get("/wallet", requireAuth, getWalletController);
router.get("/ledger", requireAuth, validate(ledgerSchema), getLedgerController);
router.get("/invoices", requireAuth, getInvoicesController);
router.post("/recharge", requireAuth, validate(rechargeSchema), recharge);
router.post("/subscribe", requireAuth, subscribe);
router.post("/cancel", requireAuth, cancel);

export default router;
