import { DeckView } from "../models/content/deck_view.model";
import { Deck } from "../models/content/deck.model";
import ApiError from "../utils/appError";

/** Record (upsert) that a user opened a deck — bumps lastViewedAt + viewCount. */
export async function recordDeckView(
  deckId: unknown,
  userId: string,
  workspaceId: unknown,
) {
  await DeckView.updateOne(
    { deckId, userId },
    {
      $set: { lastViewedAt: new Date(), workspaceId },
      $inc: { viewCount: 1 },
    },
    { upsert: true },
  );
}

/** Increment a deck's anonymous (public-link) view counter. */
export async function recordPublicView(deckId: unknown) {
  await Deck.updateOne({ _id: deckId }, { $inc: { publicViewCount: 1 } });
}

/** Star / unstar a deck for the current user. */
export async function setFavorite(
  deckId: string,
  userId: string,
  workspaceId: unknown,
  favorite: boolean,
) {
  const deck = await Deck.findOne({ _id: deckId, workspaceId, deletedAt: null });
  if (!deck) throw ApiError.notFound("Deck not found.");
  await DeckView.updateOne(
    { deckId, userId },
    { $set: { favorite, workspaceId } },
    { upsert: true },
  );
  return { favorite };
}

/**
 * Who has viewed a deck (logged-in workspace members), newest first, plus the
 * anonymous public-link open count. For the owner's audience analytics.
 */
export async function getDeckViewers(deckId: string, workspaceId: unknown) {
  const deck: any = await Deck.findOne({
    _id: deckId,
    workspaceId,
    deletedAt: null,
  }).lean();
  if (!deck) throw ApiError.notFound("Deck not found.");

  const views = await DeckView.find({ deckId, viewCount: { $gt: 0 } })
    .sort({ lastViewedAt: -1 })
    .populate("userId", "userName email avatar")
    .lean();

  return {
    anonymousViews: deck.publicViewCount ?? 0,
    viewers: views.map((v: any) => ({
      userId: String(v.userId?._id ?? v.userId),
      name: v.userId?.userName ?? "Someone",
      email: v.userId?.email ?? "",
      avatar: v.userId?.avatar ?? "",
      lastViewedAt: v.lastViewedAt,
      viewCount: v.viewCount,
    })),
  };
}
