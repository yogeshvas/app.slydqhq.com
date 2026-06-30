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
    // Workspace opened by default on login.
    defaultWorkspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
    },
  },
  {
    timestamps: true,
  },
);

export const User = mongoose.model("User", userSchema);
