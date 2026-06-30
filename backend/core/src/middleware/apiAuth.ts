import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";
import { ApiKey } from "../models/identity/api_keys.model";
import { Workspace } from "../models/identity/workspace.model";
import ApiError from "../utils/appError";

export interface ApiCaller {
  keyId: unknown;
  workspaceId: unknown;
  /** The key creator — used as the author of API-generated decks. */
  userId: string;
  budgetCredits: number | null;
  spentCredits: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      apiCaller?: ApiCaller;
    }
  }
}

/** sha-256 of the raw key — only the hash is stored. */
export function hashApiKey(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/**
 * Authenticate a public-API request via `Authorization: Bearer sk_live_…`.
 * Resolves the (non-revoked, enabled) ApiKey + its workspace, enforces that the
 * workspace is on Pro, and attaches `req.apiCaller`. Never logs the raw key.
 */
export async function apiAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const header = req.headers.authorization;
    const raw = header?.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!raw || !raw.startsWith("sk_live_")) {
      throw ApiError.unauthorized("Missing or malformed API key.");
    }

    const key: any = await ApiKey.findOne({ hashedKey: hashApiKey(raw) });
    if (!key || key.revokedAt || key.enabled === false) {
      throw ApiError.unauthorized("Invalid or revoked API key.");
    }

    const ws: any = await Workspace.findById(key.workspaceId).lean();
    if (!ws) throw ApiError.unauthorized("Workspace not found for this key.");
    if (ws.plan !== "pro") {
      throw ApiError.forbidden(
        "The API requires a Pro plan. Upgrade to use API generation.",
      );
    }

    // Touch lastUsedAt (best-effort, fire-and-forget).
    ApiKey.updateOne({ _id: key._id }, { lastUsedAt: new Date() }).catch(() => {});

    req.apiCaller = {
      keyId: key._id,
      workspaceId: key.workspaceId,
      userId: String(key.createdBy),
      budgetCredits: key.budgetCredits ?? null,
      spentCredits: key.spentCredits ?? 0,
    };
    next();
  } catch (err) {
    next(err);
  }
}
