import express from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requirePro } from "../middleware/requirePro";
import { validate } from "../middleware/validate";
import {
  getMyWorkspace,
  listWorkspaces,
  postSwitchWorkspace,
} from "../controllers/workspace.controller";
import {
  deleteInvite,
  deleteMember,
  getMembers,
  patchMemberRole,
  postInvite,
  postLeave,
} from "../controllers/members.controller";
import {
  inviteIdParamSchema,
  inviteMemberSchema,
  memberParamSchema,
  switchWorkspaceSchema,
  updateRoleSchema,
} from "../validators/workspace.validator";

const router = express.Router();

router.get("/me", requireAuth, getMyWorkspace);
router.get("/", requireAuth, listWorkspaces);
router.post(
  "/switch",
  requireAuth,
  validate(switchWorkspaceSchema),
  postSwitchWorkspace,
);

// ── Members ──────────────────────────────────────────────────────────────────
router.get("/members", requireAuth, getMembers);
router.post(
  "/members/invite",
  requireAuth,
  requirePro("members"),
  validate(inviteMemberSchema),
  postInvite,
);
router.patch(
  "/members/:userId/role",
  requireAuth,
  validate(updateRoleSchema),
  patchMemberRole,
);
router.delete(
  "/members/:userId",
  requireAuth,
  validate(memberParamSchema),
  deleteMember,
);
router.delete(
  "/invites/:id",
  requireAuth,
  validate(inviteIdParamSchema),
  deleteInvite,
);
router.post("/leave", requireAuth, postLeave);

export default router;
