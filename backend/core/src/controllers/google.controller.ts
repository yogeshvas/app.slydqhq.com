import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import ApiResponse from "../responses/apiResponse";

export const googleCallback = (req: Request, res: Response) => {
  const user = req.user as any;

  const token = jwt.sign({ id: user._id, email: user.email }, env.JWT_SECRET, {
    expiresIn: "7d",
  });

  return ApiResponse.success(res, {
    message: "User authenticated successfully",
    data: { token },
  });
};
