import type { Request, Response } from "express";
import asyncHandler from "../middleware/asyncHandler";
import ApiResponse from "../responses/apiResponse";
import { submitFeedback } from "../services/feedback.service";

/** POST /feedback — deliver an in-app feedback/support message to the team. */
export const postFeedback = asyncHandler(async (req: Request, res: Response) => {
  const { message, category } = req.body as {
    message: string;
    category?: string;
  };
  const data = await submitFeedback(req.auth!.id, message, category);
  return ApiResponse.created(res, data, "Thanks — your message was sent!");
});
