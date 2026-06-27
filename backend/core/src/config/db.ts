import mongoose from "mongoose";
import { env } from "./env";
import { logger } from "../utils/logger";

const connectDB = async () => {
  try {
    await mongoose.connect(env.MONGOURI, {
      dbName: "dev",
      serverSelectionTimeoutMS: 5000,
    });
    logger.info("MongoDB connected");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(
      `Could not reach MongoDB. Check that MONGOURI points to a running database. (${message})`
    );
    throw err;
  }
};

export default connectDB;
