import express from "express";
import { logger } from "./src/utils/logger";
import errorHandler from "./src/middleware/errorHandler";
import path from "path";
import passport from "./src/config/passport";
const app = express();
import router from "./src/routes";
import apiV1Router from "./src/routes/api-v1";

// Slide HTML can embed base64 image data URIs (AI illustrations), so a single
// slide payload can be a few MB — well past body-parser's 100kb default.
// Capture the raw body so the Razorpay webhook can verify its signature (HMAC is
// computed over the exact bytes Razorpay sent, not the re-serialized JSON).
app.use(
  express.json({
    limit: "25mb",
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ limit: "25mb", extended: true }));
app.use(passport.initialize());

app.get("/health", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Public, key-authenticated REST API (separate from the cookie/JWT app routes).
app.use("/api/v1", apiV1Router);
app.use("/api", router);

app.use(errorHandler);
export default app;
