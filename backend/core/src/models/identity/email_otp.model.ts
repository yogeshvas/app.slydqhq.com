import mongoose from "mongoose";

/**
 * Short-lived email OTPs for passwordless login. Codes are stored HASHED
 * (never plaintext). A TTL index on `expiresAt` lets MongoDB auto-delete
 * expired codes so the collection stays clean without a cron job.
 */
const emailOtpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    codeHash: { type: String, required: true },
    purpose: { type: String, default: "login" },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// TTL: remove the document as soon as `expiresAt` passes.
emailOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const EmailOtp = mongoose.model("EmailOtp", emailOtpSchema);
