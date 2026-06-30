import { randomUUID } from "crypto";
import { env } from "../config/env";
import ApiError from "../utils/appError";
import { MIME_EXTENSIONS } from "../config/constants";

/**
 * Object storage (Cloudflare R2, S3-compatible) via Bun's built-in S3 client.
 * Uploads use presigned PUT URLs so the file bytes go browser → R2 directly and
 * never pass through core — the scalable path. Core only mints the URL and later
 * records the resulting public URL as an Asset.
 */

type S3Client = InstanceType<typeof Bun.S3Client>;
let client: S3Client | null = null;

/** True when every credential needed to talk to R2 is present. */
export function isStorageConfigured(): boolean {
  return Boolean(
    env.R2_ACCESS_KEY_ID &&
      env.R2_SECRET_ACCESS_KEY &&
      env.R2_BUCKET &&
      (env.R2_ENDPOINT || env.R2_ACCOUNT_ID),
  );
}

function getClient(): S3Client {
  if (!isStorageConfigured()) {
    throw ApiError.serviceUnavailable(
      "File storage isn't configured. Set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET and R2_ACCOUNT_ID (or R2_ENDPOINT).",
    );
  }
  if (!client) {
    const endpoint =
      env.R2_ENDPOINT ?? `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
    client = new Bun.S3Client({
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      bucket: env.R2_BUCKET,
      endpoint,
      region: "auto",
    });
  }
  return client;
}

/** The public URL an object key is served from (R2 public domain / CDN). */
export function publicUrl(key: string): string {
  if (!env.R2_PUBLIC_BASE_URL) {
    throw ApiError.serviceUnavailable(
      "R2_PUBLIC_BASE_URL is not set — uploaded media has no public URL to serve from.",
    );
  }
  return `${env.R2_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`;
}

/** Deterministic object key, namespaced per workspace. */
export function buildKey(workspaceId: string, contentType: string): string {
  const ext = MIME_EXTENSIONS[contentType] ?? "bin";
  return `uploads/${workspaceId}/${randomUUID()}.${ext}`;
}

export interface PresignedUpload {
  key: string;
  uploadUrl: string; // PUT here with header Content-Type: <contentType>
  publicUrl: string; // where it'll be readable once uploaded
  expiresIn: number;
}

/** Mint a presigned PUT URL for a new object. */
export function presignUpload(
  workspaceId: string,
  contentType: string,
): PresignedUpload {
  const key = buildKey(workspaceId, contentType);
  const uploadUrl = getClient().presign(key, {
    method: "PUT",
    expiresIn: env.UPLOAD_URL_TTL_SECONDS,
    type: contentType,
  });
  return {
    key,
    uploadUrl,
    publicUrl: publicUrl(key),
    expiresIn: env.UPLOAD_URL_TTL_SECONDS,
  };
}

/** Upload bytes directly from the server (e.g. a generated export) → public URL. */
export async function putObject(
  key: string,
  bytes: Uint8Array | ArrayBuffer | Buffer,
  contentType: string,
): Promise<string> {
  await getClient().write(key, bytes, { type: contentType });
  return publicUrl(key);
}

/** Object key for a deck export file, namespaced per workspace. */
export function buildExportKey(
  workspaceId: string,
  deckId: string,
  format: string,
): string {
  return `exports/${workspaceId}/${deckId}/${Date.now()}.${format}`;
}

/** Best-effort delete of an uploaded object (no-op for non-upload assets). */
export async function deleteObject(key?: string | null): Promise<void> {
  if (!key || !isStorageConfigured()) return;
  await getClient().delete(key);
}
