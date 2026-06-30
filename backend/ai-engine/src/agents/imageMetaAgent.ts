import { openAIClient } from "../config/ai.client";

// Vision-capable model — describes the actual pixels so the media library is
// searchable by what's IN the image, not just the prompt that made it.
const VISION_MODEL = "gpt-4o-mini";

const META_PROMPT = `You label images for a searchable media library. Look at the image and
return STRICT JSON describing ONLY what is visibly present — never guess context you can't see.

Return one JSON object:
{
  "title": "3-6 word human title of the image",
  "description": "one factual sentence describing what is visible",
  "tags": ["8-15 short lowercase keywords"]
}

tags must cover: main subjects/objects, setting/scene, dominant colors, visual style
(e.g. photo, 3d-render, flat-illustration, line-art), and mood. Single or two-word tags,
lowercase, no duplicates, no '#'. No prose outside the JSON.`;

export interface ImageMeta {
  title: string;
  description: string;
  tags: string[];
}

/**
 * Fetch the image and return a base64 data URI. We send bytes (not the raw URL)
 * to the model because our image URLs are often engine-local (localhost) or
 * private and therefore not fetchable by OpenAI's servers. The engine itself can
 * reach them, so it does the fetch.
 */
async function toDataUri(imageUrl: string): Promise<string> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Couldn't fetch image (${res.status})`);
  const mime = res.headers.get("content-type")?.split(";")[0] || "image/png";
  const buf = Buffer.from(await res.arrayBuffer());
  return `data:${mime};base64,${buf.toString("base64")}`;
}

/** Derive searchable metadata for an image from its URL via an OpenAI vision model. */
export async function describeImage(imageUrl: string): Promise<ImageMeta> {
  const dataUri = await toDataUri(imageUrl);
  const response = await openAIClient.responses.create({
    model: VISION_MODEL,
    instructions: META_PROMPT,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: "Return json describing this image." },
          { type: "input_image", image_url: dataUri, detail: "low" },
        ],
      },
    ],
    text: { format: { type: "json_object" } },
  } as any);

  const parsed = JSON.parse(response.output_text ?? "{}");
  const tags = Array.isArray(parsed.tags)
    ? parsed.tags
        .map((t: unknown) => String(t).trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 15)
    : [];
  return {
    title: typeof parsed.title === "string" ? parsed.title.trim() : "",
    description:
      typeof parsed.description === "string" ? parsed.description.trim() : "",
    tags: [...new Set<string>(tags)],
  };
}
