import express from "express";
import { requireAuth } from "../middleware/requireAuth";
import { validate } from "../middleware/validate";
import {
  createMediaUploadUrl,
  deleteMedia,
  listMedia,
  listMediaTags,
  registerMediaUpload,
  updateMediaTags,
} from "../controllers/media.controller";
import {
  listMediaSchema,
  mediaIdSchema,
  registerUploadSchema,
  updateTagsSchema,
  uploadUrlSchema,
} from "../validators/media.validator";

const router = express.Router();

router.get("/", requireAuth, validate(listMediaSchema), listMedia);
router.get("/tags", requireAuth, listMediaTags);
router.post("/upload-url", requireAuth, validate(uploadUrlSchema), createMediaUploadUrl);
router.post("/", requireAuth, validate(registerUploadSchema), registerMediaUpload);
router.patch("/:id", requireAuth, validate(updateTagsSchema), updateMediaTags);
router.delete("/:id", requireAuth, validate(mediaIdSchema), deleteMedia);

export default router;
