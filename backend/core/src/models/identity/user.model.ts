import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    userName: {
      type: String,
      unique: true,
      required: true,
    },
    email: {
      type: String,
      unique: true,
      required: true,
    },
    avatar: {
      type: String,
      default: "",
    },
    googleId: {
      type: String,
    },
    // Linked logins — Google now, email/password etc. later with no migration.
    authProviders: [
      {
        provider: { type: String },
        providerId: { type: String },
      },
    ],
    // Workspace opened by default on login (the user's own personal workspace).
    defaultWorkspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
    },
    // The workspace the user is currently viewing (may be one they were invited
    // to). Falls back to defaultWorkspaceId when null or membership is gone.
    activeWorkspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      default: null,
    },

    // Referral program: this user's own shareable code, and who referred them.
    referralCode: {
      type: String,
      unique: true,
      sparse: true,
    },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

export const User = mongoose.model("User", userSchema);
