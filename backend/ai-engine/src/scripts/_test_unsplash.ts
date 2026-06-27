import { generateIllustration } from "../services/illustration.service";

const result = await generateIllustration(
  "cover",
  "Metropolis WhatsApp & SMS Engagement Platform",
  "corporate",
  "hero",
  "widescreen_16_9",
  null
);
console.log("result:", result?.fileName, "size:", result?.fileUrl?.length, "bytes base64");
