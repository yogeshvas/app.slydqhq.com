import jwt from "jsonwebtoken";
import { env } from "../config/env";

interface TokenUser {
  _id: unknown;
  email: string;
}

/** Mint the app's auth JWT. Shared by every login path (Google, email OTP, …). */
export function signAuthToken(user: TokenUser): string {
  return jwt.sign({ id: user._id, email: user.email }, env.JWT_SECRET, {
    expiresIn: "7d",
  });
}
