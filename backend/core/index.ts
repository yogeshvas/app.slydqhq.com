import app from "./app";
import connectDB from "./src/config/db";
import { logger } from "./src/utils/logger";

connectDB()
  .then(() => {
    app.listen(3000, () => {
      logger.info("server is working at host" + 3000);
    });
  })
  .catch((err) => {
    logger.error({ err }, "Failed to connect to MongoDB");
    process.exit(1);
  });
