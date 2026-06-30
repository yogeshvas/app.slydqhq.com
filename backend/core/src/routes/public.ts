import express from "express";
import { validate } from "../middleware/validate";
import {
  exportPublicDeck,
  viewPublicDeck,
} from "../controllers/public.controller";
import {
  exportPublicDeckSchema,
  viewPublicDeckSchema,
} from "../validators/public.validator";

// Unauthenticated routes for shared (public-link) decks. No requireAuth — access
// is gated by the share token (+ optional password) inside the services.
const router = express.Router();

router.post("/decks/:token", validate(viewPublicDeckSchema), viewPublicDeck);
router.post(
  "/decks/:token/export",
  validate(exportPublicDeckSchema),
  exportPublicDeck,
);

export default router;
