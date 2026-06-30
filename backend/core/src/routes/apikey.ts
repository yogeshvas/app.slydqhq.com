import express from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requirePro } from "../middleware/requirePro";
import { validate } from "../middleware/validate";
import {
  createKey,
  deleteKey,
  listKeys,
  updateKey,
} from "../controllers/apikey.controller";
import {
  createKeySchema,
  keyIdSchema,
  updateKeySchema,
} from "../validators/apikey.validator";

// API-key management — authenticated app routes, Pro plan only.
const router = express.Router();

router.get("/", requireAuth, requirePro("api"), listKeys);
router.post("/", requireAuth, requirePro("api"), validate(createKeySchema), createKey);
router.patch("/:id", requireAuth, requirePro("api"), validate(updateKeySchema), updateKey);
router.delete("/:id", requireAuth, requirePro("api"), validate(keyIdSchema), deleteKey);

export default router;
