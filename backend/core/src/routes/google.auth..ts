import express from "express";
import passport from "passport";
import { googleCallback } from "../controllers/google.controller";
const router = express.Router();

router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  }),
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/api/v1/auth/google/failed",
    session: false,
  }),
  googleCallback,
);

router.get("/google/failed", (req, res) => {
  res
    .status(401)
    .json({ success: false, message: "Google authentication failed" });
});

export default router;
