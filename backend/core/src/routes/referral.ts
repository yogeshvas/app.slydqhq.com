import express from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth";
import { validate } from "../middleware/validate";
import { claim, getReferral } from "../controllers/referral.controller";

const claimSchema = z.object({
  body: z.object({ code: z.string().trim().min(1).max(40) }),
});

const router = express.Router();

router.get("/me", requireAuth, getReferral);
router.post("/claim", requireAuth, validate(claimSchema), claim);

export default router;
