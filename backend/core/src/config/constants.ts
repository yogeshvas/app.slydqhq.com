/**
 * Non-secret app constants. Magic numbers/strings live here, not inline in
 * services (see CLAUDE.md). Env-driven values belong in `env.ts` instead.
 */

// ── Generation ──────────────────────────────────────────────────────────────
// NOTE: credit pricing (deck cost, AI image/edit cost, grants, plans) now lives in
// `config/pricing.ts` — the single source of truth for the money system.
/** Slide-count bounds enforced by the ai-engine pipeline. */
export const MIN_SLIDES = 5;
export const MAX_SLIDES = 21;
export const DEFAULT_SLIDES = 12;

/**
 * Layouts that render a photo/illustration (mirror the ai-engine). A new slide on
 * one of these gets a free stock photo auto-filled so it never starts empty.
 */
export const IMAGE_LAYOUTS = new Set([
  "hero",
  "image_left",
  "image_right",
  "quote_image",
]);

// ── Media library ─────────────────────────────────────────────────────────────
/** The library tabs / asset sources users can filter by. */
export const MEDIA_SOURCES = ["ai", "unsplash", "upload"] as const;
export type MediaSource = (typeof MEDIA_SOURCES)[number];

/** Image content-types accepted for upload → file extension for the object key. */
export const MIME_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/avif": "avif",
};

/** Default + max page size for the media listing (server-side paging). */
export const MEDIA_PAGE_SIZE = 40;
export const MEDIA_PAGE_SIZE_MAX = 100;

/** Default + max page size for the deck list (dashboard, paged/infinite). */
export const DECK_PAGE_SIZE = 24;
export const DECK_PAGE_SIZE_MAX = 60;

// ── Export ────────────────────────────────────────────────────────────────────
/** Supported deck export formats and their MIME types + file extensions. */
export const EXPORT_FORMATS = ["pdf", "pptx", "png"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];
export const EXPORT_MIME: Record<ExportFormat, string> = {
  pdf: "application/pdf",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  png: "application/zip", // a zip of one PNG per slide
};
export const EXPORT_EXT: Record<ExportFormat, string> = {
  pdf: "pdf",
  pptx: "pptx",
  png: "zip",
};
/** Cap on user-added tags per asset, and tag length. */
export const MEDIA_MAX_TAGS = 20;
export const MEDIA_MAX_TAG_LEN = 40;

// ── Workspace members & invites ─────────────────────────────────────────────────
/** Membership roles. owner/admin manage members; member has full edit access. */
export const WORKSPACE_ROLES = ["owner", "admin", "member"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];
/** Roles an invite can grant (owner is reserved for the creator). */
export const INVITABLE_ROLES = ["admin", "member"] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];
/** Roles allowed to manage members (invite, change role, remove). */
export const MANAGER_ROLES: readonly WorkspaceRole[] = ["owner", "admin"];
/** How long a workspace invite link stays valid. */
export const INVITE_EXPIRY_DAYS = 14;

// ── Support / feedback ──────────────────────────────────────────────────────────
/** Inbox that in-app feedback submissions are delivered to. */
export const FEEDBACK_EMAIL = "writetokhair@gmail.com";
