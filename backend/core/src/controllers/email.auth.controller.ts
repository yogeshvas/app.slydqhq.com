import type { Request, Response } from "express";
import asyncHandler from "../middleware/asyncHandler";
import ApiResponse from "../responses/apiResponse";
import { requestEmailOtp, verifyEmailOtp } from "../services/otp.service";

/** POST /auth/email/request-otp — email a one-time code to the address. */
export const requestOtp = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body as { email: string };
  await requestEmailOtp(email);
  return ApiResponse.success(
    res,
    { email },
    "We've sent a verification code to your email.",
  );
});

/** POST /auth/email/verify-otp — verify the code and return an auth token. */
export const verifyOtp = asyncHandler(async (req: Request, res: Response) => {
  const { email, otp, name } = req.body as {
    email: string;
    otp: string;
    name?: string;
  };
  const { token } = await verifyEmailOtp(email, otp, name);
  return ApiResponse.success(res, { token }, "Logged in successfully.");
});
