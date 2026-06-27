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
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = parsed.data;
