import type { NextFunction, Request, Response } from "express";
import ApiError from "../utils/appError";

/**
 * Simple in-memory sliding-window rate limiter, keyed per (identity, bucket).
 * Good enough for a single core instance; swap to Redis when horizontally scaled.
 * On exceed → 429 with a `Retry-After` (seconds) header.
 */
interface Window {
  hits: number[]; // timestamps (ms)
}
const store = new Map<string, Window>();

// Periodically drop empty windows so the map doesn't grow unbounded.
setInterval(
  () => {
    const now = Date.now();
    for (const [k, w] of store) {
      w.hits = w.hits.filter((t) => now - t < 3_600_000);
      if (w.hits.length === 0) store.delete(k);
    }
  },
  5 * 60_000,
).unref?.();

interface Limit {
  windowMs: number;
  max: number;
}

function check(id: string, limits: Limit[]): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const w = store.get(id) ?? { hits: [] };
  // Keep only hits within the largest window.
  const widest = Math.max(...limits.map((l) => l.windowMs));
  w.hits = w.hits.filter((t) => now - t < widest);

  for (const l of limits) {
    const inWindow = w.hits.filter((t) => now - t < l.windowMs).length;
    if (inWindow >= l.max) {
      const oldest = Math.min(...w.hits.filter((t) => now - t < l.windowMs));
      const retryAfter = Math.ceil((l.windowMs - (now - oldest)) / 1000);
      store.set(id, w);
      return { ok: false, retryAfter: Math.max(retryAfter, 1) };
    }
  }
  w.hits.push(now);
  store.set(id, w);
  return { ok: true, retryAfter: 0 };
}

/**
 * Rate-limit middleware. `bucket` namespaces the limit; `idOf` derives the
 * identity to throttle (default: the API key id). Pass one or more limits.
 */
export function rateLimit(
  bucket: string,
  limits: Limit[],
  idOf?: (req: Request) => string,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const base = idOf
      ? idOf(req)
      : String(req.apiCaller?.keyId ?? req.ip ?? "anon");
    const { ok, retryAfter } = check(`${bucket}:${base}`, limits);
    if (!ok) {
      res.setHeader("Retry-After", String(retryAfter));
      return next(
        ApiError.tooManyRequests(
          `Rate limit exceeded. Retry after ${retryAfter}s.`,
        ),
      );
    }
    next();
  };
}

// Preset limits (see API_PLAN.md §0).
export const GENERATE_LIMITS: Limit[] = [
  { windowMs: 60_000, max: 20 }, // 20 / min
  { windowMs: 3_600_000, max: 200 }, // 200 / hour
];
export const STATUS_LIMITS: Limit[] = [{ windowMs: 60_000, max: 60 }]; // 60 / min
