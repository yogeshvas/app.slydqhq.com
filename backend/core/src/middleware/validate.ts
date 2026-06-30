import { type Request, type Response, type NextFunction } from "express";
import { type ZodObject, type ZodRawShape } from "zod";
import ApiError from "../utils/appError";

/**
 * Build a request validator from a Zod schema. Schemas wrap the request in
 * `{ body, query, params }`, so we validate that whole shape and report
 * field-level errors back to the client.
 */
export const validate =
  <T extends ZodRawShape>(schema: ZodObject<T>) =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (result.success) {
      return next();
    }

    // Per-field details so clients can highlight the offending input.
    const errors = result.error.issues.map((issue) => ({
      // Drop the leading "body"/"query"/"params" wrapper from the path.
      field: issue.path.slice(1).join(".") || issue.path.join("."),
      message: issue.message,
    }));

    // A missing/empty body shows up as the top-level wrapper being undefined —
    // surface a clear message instead of the raw "expected object, received
    // undefined" from Zod.
    const first = result.error.issues[0];
    const wrapperMissing =
      first &&
      first.path.length === 1 &&
      ["body", "query", "params"].includes(String(first.path[0]));
    const message = wrapperMissing
      ? `Request ${String(first.path[0])} is required.`
      : first?.message ?? "Invalid request";

    return next(ApiError.badRequest(message, errors));
  };
