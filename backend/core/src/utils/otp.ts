import crypto from "crypto";
import { env } from "../config/env";

/** Generate a cryptographically-secure numeric OTP of the given length. */
export function generateNumericOtp(length: number): string {
  const bytes = crypto.randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i++) {
    code += (bytes[i]! % 10).toString();
  }
  return code;
}

/** Keyed (HMAC) hash of an OTP so the DB never stores the plaintext code. */
export function hashOtp(code: string): string {
  return crypto.createHmac("sha256", env.JWT_SECRET).update(code).digest("hex");
}

/** Constant-time comparison of two hex hashes. */
export function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}
