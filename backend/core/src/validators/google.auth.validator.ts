import { z } from "zod";

// `validate` middleware parses `{ body: req.body }`, so schemas wrap `body`.
export const googleOneTapSchema = z.object({
  body: z.object({
    // The Google Identity Services ID token (JWT) returned to the client.
    credential: z.string().min(10, "Missing Google credential."),
  }),
});
