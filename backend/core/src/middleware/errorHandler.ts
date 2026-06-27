import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import ApiError from "../utils/appError";
import { logger } from "../utils/logger";

// Normalize known operational errors (Mongoose, Mongo driver) into ApiError
// so they become clean 4xx responses instead of generic 500s.
const normalize = (err: any): ApiError => {
  if (err instanceof ApiError) return err;

  // Mongoose schema validation (e.g. missing required field)
  if (err instanceof mongoose.Error.ValidationError) {
    const errors = Object.values(err.errors).map((e) => ({
      path: (e as any).path,
      message: e.message,
    }));
    return ApiError.unprocessableEntity("Validation failed", errors);
  }

  // Bad ObjectId / cast failure
  if (err instanceof mongoose.Error.CastError) {
    return ApiError.badRequest(`Invalid value for "${err.path}"`);
  }

  // Mongo duplicate key
  if (err?.code === 11000) {
    const field = Object.keys(err.keyValue ?? {})[0] ?? "field";
    return ApiError.conflict(`${field} already exists`);
  }

  return ApiError.internal();
};

const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const apiError = normalize(err);
  const context = { method: req.method, url: req.originalUrl };

  if (apiError.statusCode >= 500) {
    // Genuine server error — log the full error with stack.
    logger.error({ ...context, err }, apiError.message);
  } else {
    // Client error — log a one-line warning, no stack noise.
    logger.warn(
      { ...context, statusCode: apiError.statusCode },
      apiError.message,
    );
  }

  return res.status(apiError.statusCode).json({
    success: false,
    statusCode: apiError.statusCode,
    message: apiError.message,
    errors: apiError.errors,
  });
};

export default errorHandler;
