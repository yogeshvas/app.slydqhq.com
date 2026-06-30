import crypto from "crypto";
import { ApiKey } from "../models/identity/api_keys.model";
import ApiError from "../utils/appError";
import { hashApiKey } from "../middleware/apiAuth";

type AnyDoc = Record<string, any> & { save(): Promise<unknown> };

/** Generate a fresh secret key: sk_live_<40 url-safe chars>. */
function generateKey(): string {
  return `sk_live_${crypto.randomBytes(30).toString("base64url")}`;
}

/** Public-safe view of a key — never includes the secret. */
function present(k: any) {
  return {
    _id: String(k._id),
    name: k.name,
    prefix: k.prefix,
    budgetCredits: k.budgetCredits ?? null,
    spentCredits: k.spentCredits ?? 0,
    enabled: k.enabled !== false,
    revoked: Boolean(k.revokedAt),
    lastUsedAt: k.lastUsedAt ?? null,
    createdAt: k.createdAt,
  };
}

/** A workspace's keys (newest first), secrets never returned. */
export async function listApiKeys(workspaceId: unknown) {
  const keys = await ApiKey.find({ workspaceId }).sort({ createdAt: -1 }).lean();
  return keys.map(present);
}

/**
 * Create a key. Returns the FULL secret exactly once (only the hash + a short
 * prefix are stored).
 */
export async function createApiKey(
  workspaceId: unknown,
  userId: string,
  name: string,
  budgetCredits?: number | null,
) {
  const trimmed = name.trim();
  if (!trimmed) throw ApiError.badRequest("A key name is required.");

  const secret = generateKey();
  const prefix = `${secret.slice(0, 16)}…`; // e.g. sk_live_ab12cd34…

  const doc = (await ApiKey.create({
    workspaceId,
    name: trimmed,
    hashedKey: hashApiKey(secret),
    prefix,
    createdBy: userId,
    budgetCredits: budgetCredits ?? null,
    spentCredits: 0,
    enabled: true,
  })) as unknown as AnyDoc;

  // `key` is shown ONCE here and never retrievable again.
  return { key: secret, apiKey: present(doc) };
}

/** Update a key's name / budget / enabled flag (scoped to its workspace). */
export async function updateApiKey(
  keyId: string,
  workspaceId: unknown,
  patch: { name?: string; budgetCredits?: number | null; enabled?: boolean },
) {
  const key = (await ApiKey.findOne({
    _id: keyId,
    workspaceId,
  })) as unknown as AnyDoc | null;
  if (!key) throw ApiError.notFound("API key not found.");
  if (key.revokedAt) throw ApiError.badRequest("This key is revoked.");
  if (patch.name !== undefined) {
    const t = patch.name.trim();
    if (!t) throw ApiError.badRequest("A key name is required.");
    key.name = t;
  }
  if (patch.budgetCredits !== undefined) key.budgetCredits = patch.budgetCredits;
  if (patch.enabled !== undefined) key.enabled = patch.enabled;
  await key.save();
  return present(key);
}

/** Revoke a key (permanent — auth lookups exclude revoked keys). */
export async function revokeApiKey(keyId: string, workspaceId: unknown) {
  const res = await ApiKey.updateOne(
    { _id: keyId, workspaceId, revokedAt: null },
    { revokedAt: new Date(), enabled: false },
  );
  if (res.matchedCount === 0) throw ApiError.notFound("API key not found.");
  return { ok: true };
}
