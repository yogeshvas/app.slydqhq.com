import { z } from "zod";

// `validate` middleware parses `{ body: req.body }`, so schemas wrap `body`.
export const requestOtpSchema = z.object({
  body: z.object({
    email: z.string().email("Please enter a valid email address."),
  }),
});

export const verifyOtpSchema = z.object({
  body: z.object({
    email: z.string().email("Please enter a valid email address."),
    otp: z
      .string()
      .min(4, "Enter the code from your email.")
      .max(8, "That code looks too long."),
    // Optional display name — only used when this verify creates a new account
    // (passwordless sign-up). Ignored for existing users.
    name: z.string().trim().min(1).max(80).optional(),
  }),
});
