import { type Request, type Response, type NextFunction } from "express";
import { type ZodObject, type ZodRawShape } from "zod";
import ApiError from "../utils/appError";

export const validate =
  <T extends ZodRawShape>(schema: ZodObject<T>) =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse({ body: req.body });
    if (!result.success) {
      const message = result.error.issues[0]?.message ?? "Invalid request";
      return next(ApiError.badRequest(message));
    }
    next();
  };
