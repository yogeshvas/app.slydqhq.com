import express from "express";
import { requireAuth } from "../middleware/requireAuth";
import { getMyWorkspace } from "../controllers/workspace.controller";

const router = express.Router();

router.get("/me", requireAuth, getMyWorkspace);

export default router;
