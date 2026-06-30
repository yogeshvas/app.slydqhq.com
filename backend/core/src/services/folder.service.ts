import { Folder } from "../models/content/folder.model";
import { Deck } from "../models/content/deck.model";
import ApiError from "../utils/appError";

type AnyDoc = Record<string, any> & { save(): Promise<unknown> };

/** A workspace's folders with each folder's live deck count, newest first. */
export async function listFolders(workspaceId: unknown) {
  const folders = await Folder.find({ workspaceId }).sort({ createdAt: -1 }).lean();
  if (folders.length === 0) return [];

  // Deck counts per folder (one grouped query).
  const counts = await Deck.aggregate([
    {
      $match: {
        workspaceId: (folders[0] as any).workspaceId,
        deletedAt: null,
        folderId: { $in: folders.map((f: any) => f._id) },
      },
    },
    { $group: { _id: "$folderId", count: { $sum: 1 } } },
  ]);
  const countByFolder = new Map(counts.map((c: any) => [String(c._id), c.count]));

  return folders.map((f: any) => ({
    _id: String(f._id),
    name: f.name,
    color: f.color,
    deckCount: countByFolder.get(String(f._id)) ?? 0,
    createdAt: f.createdAt,
  }));
}

/** Create a folder in the workspace. */
export async function createFolder(
  workspaceId: unknown,
  authorId: string,
  name: string,
  color?: string,
) {
  const trimmed = name.trim();
  if (!trimmed) throw ApiError.badRequest("A folder name is required.");
  const folder = (await Folder.create({
    workspaceId,
    authorId,
    name: trimmed,
    ...(color ? { color } : {}),
  })) as unknown as AnyDoc;
  return {
    _id: String(folder._id),
    name: folder.name,
    color: folder.color,
    deckCount: 0,
  };
}

/** Rename / recolor a folder (scoped to its workspace). */
export async function updateFolder(
  folderId: string,
  workspaceId: unknown,
  patch: { name?: string; color?: string },
) {
  const folder = (await Folder.findOne({
    _id: folderId,
    workspaceId,
  })) as unknown as AnyDoc | null;
  if (!folder) throw ApiError.notFound("Folder not found.");
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (!trimmed) throw ApiError.badRequest("A folder name is required.");
    folder.name = trimmed;
  }
  if (patch.color !== undefined) folder.color = patch.color;
  await folder.save();
  return { _id: String(folder._id), name: folder.name, color: folder.color };
}

/** Delete a folder; its decks are unfiled (folderId → null), never deleted. */
export async function deleteFolder(folderId: string, workspaceId: unknown) {
  const folder = await Folder.findOne({ _id: folderId, workspaceId });
  if (!folder) throw ApiError.notFound("Folder not found.");
  await Deck.updateMany(
    { folderId, workspaceId },
    { $set: { folderId: null } },
  );
  await Folder.deleteOne({ _id: folderId, workspaceId });
  return { ok: true };
}

/** Move a deck into a folder (or out of any folder when folderId is null). */
export async function moveDeckToFolder(
  deckId: string,
  workspaceId: unknown,
  folderId: string | null,
) {
  const deck = (await Deck.findOne({
    _id: deckId,
    workspaceId,
    deletedAt: null,
  })) as unknown as AnyDoc | null;
  if (!deck) throw ApiError.notFound("Deck not found.");
  if (folderId) {
    const folder = await Folder.findOne({ _id: folderId, workspaceId });
    if (!folder) throw ApiError.notFound("Folder not found.");
  }
  deck.folderId = folderId;
  await deck.save();
  return { ok: true, folderId };
}
