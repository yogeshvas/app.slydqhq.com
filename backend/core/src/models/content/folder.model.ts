import { defineModel, ref } from "../_base";

/** A workspace folder for organising decks by topic. */
export const Folder = defineModel("Folder", {
  workspaceId: ref("Workspace"),
  authorId: ref("User"),

  name: { type: String, required: true },
  // Accent color for the folder chip/icon (hex). Optional.
  color: { type: String, default: "#6366F1" },
});

// A workspace's folders, newest first.
Folder.schema.index({ workspaceId: 1, createdAt: -1 });
