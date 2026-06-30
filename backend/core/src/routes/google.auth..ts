import express from "express";
import type { NextFunction, Request, Response } from "express";
import passport from "passport";
import { googleCallback } from "../controllers/google.controller";
import { env } from "../config/env";
const router = express.Router();

/** Send any OAuth error back to the SPA login page, not as raw JSON. */
function redirectToLoginWithError(res: Response) {
  const url = new URL("/login", env.FRONTEND_URL);
  url.searchParams.set("error", "google");
  res.redirect(url.toString());
}

router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
    // Always show the account chooser instead of silently reusing the last
    // Google session.
    prompt: "select_account",
  }),
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/api/auth/google/failed",
    session: false,
  }),
  googleCallback,
);

router.get("/google/failed", (req, res) => {
  // Bounce back to the SPA login with an error flag so it can show a message.
  redirectToLoginWithError(res);
});

// Catch errors thrown inside the strategy (e.g. DB issues) and redirect the
// browser to login instead of letting the global handler return JSON.
router.use(
  (err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (err) return redirectToLoginWithError(res);
    next();
  },
);

export default router;
