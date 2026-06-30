import type { Request, Response } from "express";
import { env } from "../config/env";
import asyncHandler from "../middleware/asyncHandler";
import ApiResponse from "../responses/apiResponse";
import { signAuthToken } from "../services/token.service";
import { signInWithGoogleCredential } from "../services/google.service";

/**
 * After passport completes Google OAuth, mint a JWT and hand it back to the SPA
 * by redirecting to the frontend callback route with the token in the query
 * string. (A JSON response can't be read by the browser after a top-level OAuth
 * redirect, so we redirect instead.)
 */
export const googleCallback = (req: Request, res: Response) => {
  const user = req.user as { _id: unknown; email: string };

  const token = signAuthToken(user);

  const redirectUrl = new URL("/auth/google/callback", env.FRONTEND_URL);
  redirectUrl.searchParams.set("token", token);

  return res.redirect(redirectUrl.toString());
};

/**
 * POST /auth/google/one-tap — verify a Google Identity Services credential
 * (One Tap / Google button) and return an auth token as JSON.
 */
export const googleOneTap = asyncHandler(
  async (req: Request, res: Response) => {
    const { credential } = req.body as { credential: string };
    const { token } = await signInWithGoogleCredential(credential);
    return ApiResponse.success(res, { token }, "Logged in successfully.");
  },
);
