import { OAuth2Client } from "google-auth-library";
import { env } from "../config/env";
import ApiError from "../utils/appError";
import { logger } from "../utils/logger";
import { findOrCreateUserByEmail } from "./user.service";
import { signAuthToken } from "./token.service";

const client = new OAuth2Client(env.GOOGLE_CLIENT_ID);

interface GoogleSignInResult {
  token: string;
  user: Awaited<ReturnType<typeof findOrCreateUserByEmail>>;
}

/**
 * Verify a Google Identity Services credential (the ID token from One Tap or the
 * Google button), find-or-create the matching user, and return an auth token.
 * Verification is done offline against Google's public keys — no network call.
 */
export async function signInWithGoogleCredential(
  credential: string,
): Promise<GoogleSignInResult> {
  let payload;
  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch (err) {
    logger.warn({ err }, "Google credential verification failed");
    throw ApiError.unauthorized("Could not verify your Google sign-in.");
  }

  if (!payload?.email || !payload.email_verified) {
    throw ApiError.unauthorized("Your Google account has no verified email.");
  }

  const user = await findOrCreateUserByEmail({
    email: payload.email,
    userName: payload.name,
    avatar: payload.picture,
    provider: "google",
    providerId: payload.sub,
  });

  const token = signAuthToken(
    user as unknown as { _id: unknown; email: string },
  );

  return { token, user };
}
