import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import ApiError from "../utils/appError";

export interface AuthUser {
  id: string;
  email: string;
}

// Augment Express's Request so `req.auth` is typed everywhere downstream.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthUser;
    }
  }
}

/**
 * Verify the bearer JWT and attach `req.auth`. The token may arrive either in
 * the `Authorization: Bearer …` header or, for SSE/EventSource clients that
 * can't set headers, in a `?token=` query param.
 */
export const requireAuth = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const header = req.headers.authorization;
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  const token = bearer ?? (req.query.token as string | undefined);

  if (!token) {
    return next(ApiError.unauthorized("Authentication required."));
  }

  try {
    const claims = jwt.verify(token, env.JWT_SECRET) as {
      id: string;
      email: string;
    };
    req.auth = { id: claims.id, email: claims.email };
    return next();
  } catch {
    return next(ApiError.unauthorized("Your session is invalid or expired."));
  }
};
