import { EmailOtp } from "../models/identity/email_otp.model";
import { env } from "../config/env";
import ApiError from "../utils/appError";
import { generateNumericOtp, hashOtp, safeEqualHex } from "../utils/otp";
import { sendOtpEmail } from "./mailer.service";
import { findOrCreateUserByEmail } from "./user.service";
import { signAuthToken } from "./token.service";

const normalizeEmail = (email: string) => email.toLowerCase().trim();

/**
 * Issue a fresh OTP for an email: enforce the resend cooldown, replace any
 * previous codes, persist the hashed code, and email the plaintext to the user.
 */
export async function requestEmailOtp(rawEmail: string): Promise<void> {
  const email = normalizeEmail(rawEmail);

  // Cooldown — block rapid re-requests.
  const latest = await EmailOtp.findOne({ email }).sort({ createdAt: -1 });
  if (latest) {
    const ageSeconds = (Date.now() - latest.createdAt.getTime()) / 1000;
    const remaining = Math.ceil(env.OTP_RESEND_COOLDOWN_SECONDS - ageSeconds);
    if (remaining > 0) {
      throw ApiError.tooManyRequests(
        `Please wait ${remaining}s before requesting another code.`,
      );
    }
  }

  const code = generateNumericOtp(env.OTP_LENGTH);
  const expiresAt = new Date(Date.now() + env.OTP_EXPIRY_MINUTES * 60_000);

  // One active code per email.
  await EmailOtp.deleteMany({ email });
  await EmailOtp.create({ email, codeHash: hashOtp(code), expiresAt });

  await sendOtpEmail(email, code, env.OTP_EXPIRY_MINUTES);
}

interface VerifyResult {
  token: string;
  user: Awaited<ReturnType<typeof findOrCreateUserByEmail>>;
}

/**
 * Verify a submitted OTP. On success: consume the code, find-or-create the
 * user, and return an auth token. On failure: count the attempt and throw.
 */
export async function verifyEmailOtp(
  rawEmail: string,
  rawCode: string,
): Promise<VerifyResult> {
  const email = normalizeEmail(rawEmail);
  const code = rawCode.trim();

  const record = await EmailOtp.findOne({ email }).sort({ createdAt: -1 });
  if (!record) {
    throw ApiError.badRequest("No code found for this email. Request a new one.");
  }

  if (record.expiresAt.getTime() < Date.now()) {
    await EmailOtp.deleteMany({ email });
    throw ApiError.badRequest("This code has expired. Request a new one.");
  }

  if (record.attempts >= env.OTP_MAX_ATTEMPTS) {
    await EmailOtp.deleteMany({ email });
    throw ApiError.tooManyRequests("Too many attempts. Request a new code.");
  }

  if (!safeEqualHex(record.codeHash, hashOtp(code))) {
    record.attempts += 1;
    await record.save();
    throw ApiError.badRequest("Invalid code. Please try again.");
  }

  // Success — consume the code so it can't be reused.
  await EmailOtp.deleteMany({ email });

  const user = await findOrCreateUserByEmail({ email, provider: "email" });
  const token = signAuthToken(user as unknown as { _id: unknown; email: string });

  return { token, user };
}
