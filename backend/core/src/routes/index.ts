import express from "express";
import googleRoutes from "./google.auth.";
import googleOneTapRoutes from "./google.onetap";
import emailAuthRoutes from "./email.auth";
import workspaceRoutes from "./workspace";
import deckRoutes from "./deck";
import folderRoutes from "./folder";
import mediaRoutes from "./media";
import publicRoutes from "./public";
import billingRoutes from "./billing";

const router = express.Router();

// JSON One Tap endpoint is registered before the redirect-style OAuth router so
// its errors reach the global handler instead of the SPA login redirect.
router.use("/auth", googleOneTapRoutes);
router.use("/auth", googleRoutes);
router.use("/auth", emailAuthRoutes);

// Public (unauthenticated) share routes — registered before the auth-guarded ones.
router.use("/public", publicRoutes);

router.use("/workspaces", workspaceRoutes);
router.use("/decks", deckRoutes);
router.use("/folders", folderRoutes);
router.use("/media", mediaRoutes);
router.use("/billing", billingRoutes);

export default router;
