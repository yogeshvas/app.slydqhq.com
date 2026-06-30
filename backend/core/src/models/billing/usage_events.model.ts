import { defineModel, ObjectId, ref } from "../_base";

// Metering — feeds analytics and the credit ledger.
export const UsageEvent = defineModel("UsageEvent", {
  workspaceId: ref("Workspace"),
  userId: ref("User"),

  // e.g. deck_generated | slide_regenerated | export_pdf | …
  event: { type: String, required: true },

  // The deck / slide / export this event refers to.
  refId: { type: ObjectId },

  credits: { type: Number, default: 0 },
});

// Metering queries: a workspace's events over time.
UsageEvent.schema.index({ workspaceId: 1, createdAt: -1 });
