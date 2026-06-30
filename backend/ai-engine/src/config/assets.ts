// Where generated images are publicly reachable. Slides reference images by URL
// (NOT inlined base64) so deck HTML stays small. Today the engine serves them
// from local disk at /images/<file>; point ASSET_BASE_URL elsewhere (a CDN/S3
// bucket) later and this is the only thing that changes.
export const ASSET_BASE_URL = (
  process.env.ASSET_BASE_URL ?? "http://localhost:8080"
).replace(/\/$/, "");

/** Absolute, publicly-loadable URL for an engine asset path like "/images/x.png". */
export function assetUrl(httpPath: string): string {
  return `${ASSET_BASE_URL}${httpPath}`;
}
