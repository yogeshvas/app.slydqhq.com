import express from "express";
import { validate } from "../middleware/validate";
import { googleOneTap } from "../controllers/google.controller";
import { googleOneTapSchema } from "../validators/google.auth.validator";

// Kept separate from the OAuth redirect router (google.auth.) because this is a
// JSON API endpoint — its errors should flow to the global errorHandler, not be
// redirected back to the SPA login page.
const router = express.Router();

router.post("/google/one-tap", validate(googleOneTapSchema), googleOneTap);

export default router;
