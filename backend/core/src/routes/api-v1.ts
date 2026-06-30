import express from "express";
import { apiAuth } from "../middleware/apiAuth";
import {
  GENERATE_LIMITS,
  STATUS_LIMITS,
  rateLimit,
} from "../middleware/rateLimit";
import { validate } from "../middleware/validate";
import {
  createGeneration,
  getCredits,
  getDeck,
  getGeneration,
} from "../controllers/api-v1.controller";
import {
  generationIdSchema,
  generationSchema,
} from "../validators/api-v1.validator";

// Public REST API (key-auth). Mounted at /api/v1.
const router = express.Router();

// Every route requires a valid Pro API key.
router.use(apiAuth);

router.post(
  "/generations",
  rateLimit("generate", GENERATE_LIMITS),
  validate(generationSchema),
  createGeneration,
);
router.get(
  "/generations/:id",
  rateLimit("status", STATUS_LIMITS),
  validate(generationIdSchema),
  getGeneration,
);
router.get("/decks/:id", validate(generationIdSchema), getDeck);
router.get("/credits", getCredits);

export default router;
