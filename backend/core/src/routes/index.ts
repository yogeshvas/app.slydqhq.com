import express from "express";
import googleRoutes from "./google.auth.";

const router = express.Router();

router.use("/auth", googleRoutes);
export default router;
