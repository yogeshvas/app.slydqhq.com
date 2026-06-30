import express from "express";
import { requireAuth } from "../middleware/requireAuth";
import { validate } from "../middleware/validate";
import {
  createFolderController,
  deleteFolderController,
  listFoldersController,
  updateFolderController,
} from "../controllers/folder.controller";
import {
  createFolderSchema,
  folderIdSchema,
  updateFolderSchema,
} from "../validators/folder.validator";

const router = express.Router();

router.get("/", requireAuth, listFoldersController);
router.post("/", requireAuth, validate(createFolderSchema), createFolderController);
router.patch("/:id", requireAuth, validate(updateFolderSchema), updateFolderController);
router.delete("/:id", requireAuth, validate(folderIdSchema), deleteFolderController);

export default router;
