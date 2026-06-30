import express from "express";
import { requireAuth } from "../middleware/requireAuth";
import { validate } from "../middleware/validate";
import { postFeedback } from "../controllers/feedback.controller";
import { feedbackSchema } from "../validators/feedback.validator";

const router = express.Router();

router.post("/", requireAuth, validate(feedbackSchema), postFeedback);

export default router;
