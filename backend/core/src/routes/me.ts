import express from "express";
import { requireAuth } from "../middleware/requireAuth";
import { validate } from "../middleware/validate";
import {
  createAvatarUploadUrl,
  getMyProfile,
  updateMyProfile,
} from "../controllers/me.controller";
import { avatarUploadSchema, updateMeSchema } from "../validators/me.validator";

const router = express.Router();

router.get("/", requireAuth, getMyProfile);
router.patch("/", requireAuth, validate(updateMeSchema), updateMyProfile);
router.post("/avatar-url", requireAuth, validate(avatarUploadSchema), createAvatarUploadUrl);

export default router;
