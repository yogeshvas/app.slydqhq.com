import express from "express";
import { logger } from "./src/utils/logger";
import errorHandler from "./src/middleware/errorHandler";
import path from "path";
import passport from "./src/config/passport";
const app = express();
import router from "./src/routes";

app.use(express.json());
app.use(express.urlencoded());
app.use(passport.initialize());

app.get("/health", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use("/api", router);

app.use(errorHandler);
export default app;
