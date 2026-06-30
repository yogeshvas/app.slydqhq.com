import path from "path";
import fs from "fs";
import { openAIClient as openai } from "../config/ai.client";
import { THEMES, resolveTheme, type ThemeName } from "../config/themes";
import type { CanvasFormat } from "../config/canvas";
import type { AccentOverride } from "../config/accentColors";

type ImageSize = "1024x1024" | "1024x1536" | "1536x1024";

// These layouts show the photo in a ~50%-width column spanning the full slide
// height — portrait fits better than landscape.
const NARROW_COLUMN_LAYOUTS = new Set(["hero", "image_left", "image_right", "quote_image", "challenge_grid"]);
// These layouts show the photo full-bleed behind the whole slide.
const FULL_BLEED_LAYOUTS = new Set(["social_statement", "social_cta"]);

function resolveImageSize(layout?: string, canvas?: CanvasFormat): ImageSize {
  if (layout && NARROW_COLUMN_LAYOUTS.has(layout)) return "1024x1024";
  if (layout && FULL_BLEED_LAYOUTS.has(layout)) {
    if (canvas === "square_1_1") return "1024x1024";
    if (canvas === "vertical_9_16") return "1024x1536";
    return "1536x1024";
  }
  return "1536x1024";
}

export const IMAGES_DIR = path.resolve(process.cwd(), "generated/images");

function ensureDir() {
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

// Visual subject per slide type — used in the gpt-image-1 prompt
const TOPIC_MAP: Record<string, string> = {
  cover:                   "smartphone with chat message bubbles floating above it, WhatsApp-style notification icons, clean flat design",
  market_opportunity:      "expanding funnel with upward growth arrows, network nodes radiating outward",
  client_challenges:       "scattered disconnected nodes, tangled wires, isolated silos, stacked paper",
  solution_overview:       "central hub radiating clean connections to multiple channels, automated pipeline",
  product_capabilities:    "modular feature blocks snapping together, connected product grid",
  technical_architecture:  "layered cloud stack with server nodes and API connector lines",
  business_impact:         "rising bar chart, upward trend arrow, success metric dashboard",
  implementation_timeline: "horizontal roadmap with milestone markers and phase steps",
  pricing:                 "three tiered pricing cards side by side, value scale",
  call_to_action:          "two hands reaching toward each other, forward arrow, partnership symbol",
  competitive_advantage:   "balance scales comparing two sides, winner highlighted",
  use_cases:               "four scenario panels in a 2x2 grid, workflow steps",
  roi:                     "financial growth chart, coin stack, return on investment arrow",
  integration:             "central hub connected to multiple platform nodes via clean lines",
  hidden_costs:            "iceberg with small visible tip and large submerged mass",
  case_study:              "ascending upward path with a glowing transformation point, evolving system diagram",
  executive_summary:       "executive briefing dashboard with insight cards",
};

function buildPrompt(
  slideType: string,
  title: string,
  theme: ThemeName,
  accentOverride?: AccentOverride | null,
  userPrompt?: string,
): string {
  // A user-supplied prompt is the explicit intent — it wins over the slide-type
  // default topic. Without this the model only ever drew the TOPIC_MAP subject and
  // the user's words were silently dropped.
  const wanted = userPrompt && userPrompt.trim();
  const topic = wanted || TOPIC_MAP[slideType] || "professional enterprise software, clean workspace";
  const styleDescriptor = THEMES[theme].imageStyleDescriptor(accentOverride);
  return [
    "Purely visual flat vector illustration for a presentation slide — absolutely no typography of any kind.",
    `Visual subject: ${topic}.`,
    // Only fold in the slide title as extra context when the user did NOT give an
    // explicit prompt — otherwise the title can drag the image back toward the
    // generic slide-type look the user is trying to override.
    wanted ? "" : `Context: ${title.slice(0, 80)}.`,
    styleDescriptor,
    "NO text, NO words, NO letters, NO numbers, NO captions, NO labels like \"before\"/\"after\", NO UI mockup text, NO logos. Stylized flat characters are fine, but no photorealistic human faces.",
  ].filter(Boolean).join(" ");
}

export interface IllustrationResult {
  fileUrl:  string;  // data URI for Puppeteer (embedded directly in HTML)
  httpPath: string;  // /images/<filename> — served by Express
  fileName: string;
}

// Generates a gpt-image-1 illustration and saves it to disk.
// Called only for the AI image budget slots (cover + up to 1 mid-deck image).
// All other photo slots are handled by getUnsplashImage() in index.ts.
export async function generateIllustration(
  slideType: string,
  title: string,
  theme: ThemeName = "corporate",
  layout?: string,
  canvas?: CanvasFormat,
  accentOverride: AccentOverride | null = null,
  userPrompt?: string,  // explicit user image prompt — takes priority over the slide-type topic
): Promise<IllustrationResult | null> {
  ensureDir();

  const prompt = buildPrompt(slideType, title, resolveTheme(theme), accentOverride, userPrompt);
  const size = resolveImageSize(layout, canvas);
  console.log("[Illustration] generating via gpt-image-1:", slideType, `(theme: ${theme}, size: ${size})`);

  const response = await (openai as any).images.generate({
    model:   "gpt-image-1",
    prompt,
    n:       1,
    size,
    quality: "medium",
  });

  const imageData = response?.data?.[0];
  if (!imageData) throw new Error("No image data in response");

  let b64: string;
  if (imageData.b64_json) {
    b64 = imageData.b64_json;
  } else if (imageData.url) {
    const res = await fetch(imageData.url);
    const buf = await res.arrayBuffer();
    b64 = Buffer.from(buf).toString("base64");
  } else {
    throw new Error("No url or b64_json in response");
  }

  const titleSlug = slugify(title || slideType);
  const fileName  = `${Date.now()}_${slideType}_${titleSlug}.png`;
  const filePath  = path.join(IMAGES_DIR, fileName);
  await Bun.write(filePath, Buffer.from(b64, "base64"));

  console.log("[Illustration] gpt-image-1 saved →", fileName);

  return {
    fileUrl:  `data:image/png;base64,${b64}`,
    httpPath: `/images/${fileName}`,
    fileName,
  };
}
