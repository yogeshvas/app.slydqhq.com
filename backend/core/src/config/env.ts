import z from "zod";
import dotenv from "dotenv";
dotenv.config();

const envSchema = z.object({
  MONGOURI: z
    .string()
    .min(1, "MONGOURI is required")
    .refine(
      (v) => v.startsWith("mongodb://") || v.startsWith("mongodb+srv://"),
      'MONGOURI must start with "mongodb://" or "mongodb+srv://"',
    )
    .refine(
      (v) => !v.includes("<") && !v.includes(">"),
      "MONGOURI still contains placeholders (e.g. <cluster>, <user>, <pass>) — replace them with real values",
    ),
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  GOOGLE_CALLBACK_URL: z.string(),
  JWT_SECRET: z.string(),
  // Where the SPA lives — used to redirect back after OAuth with the token.
  FRONTEND_URL: z.string().default("http://localhost:5173"),

  // The ai-engine service that runs the slide generation pipeline (POST /jobs).
  AI_ENGINE_URL: z.string().default("http://localhost:8080"),

  // ── Object storage (Cloudflare R2 — S3-compatible) ────────────────────────
  // For user-uploaded media. Optional so the app still boots without storage
  // configured; the storage service throws a clear error at upload time if any
  // are missing. Swapping to AWS S3 means changing only R2_ENDPOINT + keys.
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  // Explicit S3 endpoint; if omitted it's derived from the account id.
  R2_ENDPOINT: z.string().optional(),
  // Public base URL objects are read from (R2 public bucket domain or a CDN),
  // e.g. https://media.yourdomain.com or https://pub-xxxx.r2.dev (no trailing /).
  R2_PUBLIC_BASE_URL: z.string().optional(),
  // Max upload size (bytes) and presign validity (seconds).
  UPLOAD_MAX_BYTES: z.coerce.number().default(15 * 1024 * 1024),
  UPLOAD_URL_TTL_SECONDS: z.coerce.number().default(600),

  // ── Razorpay (billing) ────────────────────────────────────────────────────
  // Optional so the app boots without billing configured; the billing service
  // throws a clear error at checkout time if these are missing.
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  // Razorpay subscription plan ids (created in the Razorpay dashboard), per currency.
  RAZORPAY_PRO_PLAN_ID_INR: z.string().optional(),
  RAZORPAY_PRO_PLAN_ID_USD: z.string().optional(),

  // ── Email (Mailchimp Transactional / Mandrill API) ────────────────────────
  // Optional so the app still boots without mail configured; the mailer throws
  // a clear error at send time if these are missing.
  MAILCHIMP_TRANSACTIONAL_KEY: z.string().optional(), // Mandrill API key (md-…)
  MAILCHIMP_FROM_EMAIL: z
    .string()
    .email("MAILCHIMP_FROM_EMAIL must be a valid email")
    .optional(), // verified sender, e.g. hello@yourdomain.com
  MAILCHIMP_FROM_NAME: z.string().default("Slyde HQ"),

  // ── OTP policy ────────────────────────────────────────────────────────────
  OTP_LENGTH: z.coerce.number().default(6),
  OTP_EXPIRY_MINUTES: z.coerce.number().default(10),
  OTP_MAX_ATTEMPTS: z.coerce.number().default(5),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().default(60),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = parsed.data;
