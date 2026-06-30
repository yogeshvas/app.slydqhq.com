import express from "express";
import { requireAuth } from "../middleware/requireAuth";
import { validate } from "../middleware/validate";
import { getInvite, postAcceptInvite } from "../controllers/members.controller";
import { inviteTokenParamSchema } from "../validators/workspace.validator";

const router = express.Router();

// Public preview (the accept page renders this before sign-in).
router.get("/:token", validate(inviteTokenParamSchema), getInvite);
// Accept requires the user to be signed in.
router.post(
  "/:token/accept",
  requireAuth,
  validate(inviteTokenParamSchema),
  postAcceptInvite,
);

export default router;
