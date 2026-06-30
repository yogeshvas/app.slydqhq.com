import express from "express";
import { validate } from "../middleware/validate";
import {
  requestOtp,
  verifyOtp,
} from "../controllers/email.auth.controller";
import {
  requestOtpSchema,
  verifyOtpSchema,
} from "../validators/email.auth.validator";

const router = express.Router();

router.post("/email/request-otp", validate(requestOtpSchema), requestOtp);
router.post("/email/verify-otp", validate(verifyOtpSchema), verifyOtp);

export default router;
