import { randomBytes } from "crypto";
import { DeckShare } from "../models/content/deck_shares.model";
import { Deck } from "../models/content/deck.model";
import { Slide } from "../models/content/slide.model";
import { env } from "../config/env";
import { recordPublicView } from "./view.service";
import ApiError from "../utils/appError";

type AnyDoc = Record<string, any> & { save(): Promise<unknown> };

/** A URL-safe public share token. */
function newToken(): string {
  return randomBytes(16).toString("base64url");
}

/** Shape returned to the owner (settings + the absolute link). */
function presentShare(share: any) {
  return {
    token: share.token,
    url: `${env.FRONTEND_URL.replace(/\/$/, "")}/share/${share.token}`,
    enabled: share.enabled !== false,
    hasPassword: Boolean(share.passwordHash),
    allowDownload: Boolean(share.allowDownload),
    discoverable: Boolean(share.discoverable),
  };
}

async function requireOwnedDeck(deckId: string, workspaceId: unknown) {
  const deck = await Deck.findOne({ _id: deckId, workspaceId, deletedAt: null });
  if (!deck) throw ApiError.notFound("Deck not found.");
  return deck;
}

/** Get the deck's public-link share, creating the token lazily on first access. */
export async function getOrCreateShare(deckId: string, workspaceId: unknown) {
  await requireOwnedDeck(deckId, workspaceId);
  let share = (await DeckShare.findOne({
    deckId,
    workspaceId,
    sharedWithUserId: null,
  })) as unknown as AnyDoc | null;
  if (!share) {
    share = (await DeckShare.create({
      deckId,
      workspaceId,
      token: newToken(),
      role: "viewer",
      enabled: true,
    })) as unknown as AnyDoc;
  } else if (!share.token) {
    share.token = newToken();
    await share.save();
  }
  return presentShare(share);
}

/** Update the deck's public-link settings (password, download, discoverable, enabled). */
export async function updateShareSettings(
  deckId: string,
  workspaceId: unknown,
  patch: {
    enabled?: boolean;
    allowDownload?: boolean;
    discoverable?: boolean;
    // null clears the password; a string sets a new one; undefined leaves it.
    password?: string | null;
  },
) {
  await requireOwnedDeck(deckId, workspaceId);
  let share = (await DeckShare.findOne({
    deckId,
    workspaceId,
    sharedWithUserId: null,
  })) as unknown as AnyDoc | null;
  if (!share) {
    share = (await DeckShare.create({
      deckId,
      workspaceId,
      token: newToken(),
      role: "viewer",
    })) as unknown as AnyDoc;
  }

  if (patch.enabled !== undefined) share.enabled = patch.enabled;
  if (patch.allowDownload !== undefined) share.allowDownload = patch.allowDownload;
  if (patch.discoverable !== undefined) share.discoverable = patch.discoverable;
  if (patch.password !== undefined) {
    share.passwordHash =
      patch.password === null || patch.password === ""
        ? null
        : await Bun.password.hash(patch.password);
  }
  await share.save();
  return presentShare(share);
}

/**
 * Resolve a public share by token for the unauthenticated viewer. Returns either
 * `{ passwordRequired: true }` (gate) or the read-only deck + ordered slides.
 */
export async function getPublicDeck(token: string, password?: string) {
  const share: any = await DeckShare.findOne({ token, sharedWithUserId: null });
  if (!share || share.enabled === false) {
    throw ApiError.notFound("This shared deck isn't available.");
  }
  if (share.expiresAt && new Date(share.expiresAt).getTime() < Date.now()) {
    throw ApiError.notFound("This share link has expired.");
  }

  if (share.passwordHash) {
    if (!password) return { passwordRequired: true as const };
    const ok = await Bun.password.verify(password, share.passwordHash);
    if (!ok) throw ApiError.unauthorized("Incorrect password.");
  }

  const deck: any = await Deck.findOne({ _id: share.deckId, deletedAt: null }).lean();
  if (!deck) throw ApiError.notFound("This shared deck isn't available.");
  const slides = await Slide.find({ deckId: share.deckId, deletedAt: null })
    .sort({ position: 1 })
    .lean();

  // Count this anonymous public open (best-effort).
  void recordPublicView(share.deckId);

  return {
    passwordRequired: false as const,
    allowDownload: Boolean(share.allowDownload),
    deck: {
      _id: String(deck._id),
      title: deck.title,
      canvas: deck.canvas,
      theme: deck.theme,
      styleCss: deck.styleCss ?? "",
    },
    slides: slides.map((s: any) => ({
      _id: String(s._id),
      slideNumber: s.slideNumber,
      title: s.title,
      html: s.html,
      notes: s.notes ?? "",
    })),
  };
}

/**
 * Resolve a share token to its deck id for a public download — enforcing the
 * password + allowDownload gate. Throws if download isn't permitted.
 */
export async function resolveDownloadableShare(
  token: string,
  password?: string,
): Promise<{ deckId: string; workspaceId: unknown }> {
  const share: any = await DeckShare.findOne({ token, sharedWithUserId: null });
  if (!share || share.enabled === false) {
    throw ApiError.notFound("This shared deck isn't available.");
  }
  if (!share.allowDownload) {
    throw ApiError.forbidden("Downloads aren't allowed for this deck.");
  }
  if (share.passwordHash) {
    if (!password || !(await Bun.password.verify(password, share.passwordHash))) {
      throw ApiError.unauthorized("Incorrect or missing password.");
    }
  }
  return { deckId: String(share.deckId), workspaceId: share.workspaceId };
}
