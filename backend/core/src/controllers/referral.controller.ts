import type { Request, Response } from "express";
import asyncHandler from "../middleware/asyncHandler";
import ApiResponse from "../responses/apiResponse";
import { claimReferral, getMyReferral } from "../services/referral.service";

/** GET /referral/me — my code, link, and stats. */
export const getReferral = asyncHandler(async (req: Request, res: Response) => {
  const data = await getMyReferral(req.auth!.id);
  return ApiResponse.success(res, data, "Referral info.");
});

/** POST /referral/claim — attribute a referral for the new user. */
export const claim = asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.body as { code: string };
  const result = await claimReferral(req.auth!.id, code);
  return ApiResponse.success(res, result, "Referral processed.");
});
