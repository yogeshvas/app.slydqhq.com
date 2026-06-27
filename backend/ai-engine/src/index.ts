import { urlencoded } from "body-parser"
import express from "express"
import dotenv from "dotenv"
import OpenAI from "openai"
import path from "path"
import { XMLParser } from "fast-xml-parser";
import { presentationStrategist } from "./agents/presentationStrategist";
import { layoutSelectorAgent } from "./agents/layoutSelectorAgent";
import { slideCreationAgent } from "./agents/slideCreationAgent";
import { getUnsplashImage } from "./services/unsplash.service";
import { generateIllustration, IMAGES_DIR } from "./services/illustration.service";
import { generatePDF, needsPhoto, getDeckStyles } from "./renderers/pdf.renderer";
import { validateAndFixSlide, enforceLayoutVariety } from "./services/deckQA";
import { resolveDeckType, IMAGE_BUDGET, type DeckType } from "./config/deckTypes";
import { resolveTheme } from "./config/themes";
import { resolveCanvas, WIDESCREEN_ONLY, CANVAS_DIMS, type CanvasFormat } from "./config/canvas";
import { resolveAccentOverride, type AccentOverride } from "./config/accentColors";
import { buildOutline, computeAiSlotSet, fillSlide } from "./pipeline";

dotenv.config()

const app = express()

app.use(express.json())
app.use(express.urlencoded());

// Serve generated images so they're viewable in browser at /images/<filename>
app.use("/images", express.static(IMAGES_DIR));

// List all saved AI-generated images
app.get("/images", async (_req, res) => {
    try {
        const fs = await import("fs");
        if (!fs.existsSync(IMAGES_DIR)) {
            return res.json({ images: [] });
        }
        const files = fs.readdirSync(IMAGES_DIR)
            .filter(f => f.endsWith(".png"))
            .sort()
            .reverse() // newest first
            .map(f => ({
                fileName: f,
                url: `/images/${f}`,
                createdAt: f.split("_")[0],
            }));
        res.json({ count: files.length, images: files });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.get("/health", (req, res) => {
    res.status(200).json({ success: true, message: "status is healthy" })
})

// main pipeline route
app.post("/generate", async (req, res) => {

    try {

        const start = Date.now();

        const { noOfSlides: rawSlides = 15, prompt } = req.body;
        if (!prompt && !req.body.topic && !req.body.productName) {
            return res.status(400).json({ error: "Required: prompt (e.g. { \"prompt\": \"Create a pitch deck for my AI startup\", \"noOfSlides\": 12 })" });
        }
        const noOfSlides = Math.min(Math.max(parseInt(String(rawSlides)) || 15, 5), 21);

        // Explicit deckType / theme / canvas — optional, defaulting to today's exact
        // behavior so existing {prompt, noOfSlides}-only callers are unaffected.
        const deckType: DeckType = resolveDeckType(req.body.deckType);
        const theme = resolveTheme(req.body.theme);
        const accentOverride = resolveAccentOverride(req.body.accentColor);
        const canvas: CanvasFormat = req.body.canvas
            ? resolveCanvas(req.body.canvas)
            : (deckType === "social_post" ? "square_1_1" : WIDESCREEN_ONLY);

        // The legacy 32 layouts assume widescreen geometry (side-by-side splits, 2x2
        // grids) — only social_post's canvas-agnostic layout set supports other canvases.
        if (deckType !== "social_post" && canvas !== WIDESCREEN_ONLY) {
            return res.status(400).json({
                error: `deckType "${deckType}" only supports canvas "widescreen_16_9" in this version. Use deckType "social_post" for square/vertical canvases.`,
            });
        }

        const strategist = await presentationStrategist(req.body, noOfSlides, deckType);

        const { analysis, deck } = strategist;

        // Layout Intelligence Agent — reviews all slides and assigns optimal layouts
        // from this deckType's allowed pool
        console.log("[LayoutSelector] assigning layouts...");
        deck.slides = await layoutSelectorAgent(deck.slides, deck.deckTitle, deck.storyTheme, deckType);
        console.log("[LayoutSelector] done");

        // Enforce layout variety: no layout may appear more than twice, substituting
        // from this deckType's allowed pool
        deck.slides = enforceLayoutVariety(deck.slides, deckType);

        // Pass the raw user prompt through so the slide content agent can stay on-topic
        const enrichedAnalysis = {
            ...analysis,
            _userPrompt: req.body.prompt ?? "",
        };

        const mergedSlides = (await Promise.all(
            deck.slides.map((slide: any) =>
                slideCreationAgent(enrichedAnalysis, deck.storyTheme, slide)
            )
        )).map((slide: any, index: number) => ({
            ...slide,
            slideNumber: deck.slides[index].slideNumber,
            slideType: slide.slideType || deck.slides[index].slideType,
            recommendedLayout: slide.recommendedLayout || deck.slides[index].recommendedLayout,
        }));

        // QA pass: deterministic hydration first, then a single targeted regeneration
        // for any slide whose required data array is still empty
        const generatedSlides = await Promise.all(
            mergedSlides.map((slide: any) => validateAndFixSlide(slide, enrichedAnalysis, deck.storyTheme))
        );

        // Image strategy: deckType-aware AI illustration budget (visual-heavy types
        // like social_post/case_study/testimonial get more AI images per deck)
        //   Slot 1 → cover / hero slide
        //   Slot 2+ → mid-deck image slides (quote_image, image_left, image_right, social_statement, social_cta)
        //   Everything else → Unsplash (free)
        const AI_IMAGE_LIMIT = IMAGE_BUDGET[deckType];
        // All photo-needing layouts — the first AI_IMAGE_LIMIT of these get gpt-image-1;
        // the rest fall through to Unsplash in the map below.
        const AI_PREFERRED_LAYOUTS = new Set([
            "hero", "quote_image", "image_left", "image_right",
            "social_statement", "social_cta", "split_insight",
        ]);

        // Decide which slide indices get AI images (gpt-image-1)
        let aiSlotsRemaining = AI_IMAGE_LIMIT;
        const aiSlotSet = new Set<number>();
        for (let i = 0; i < generatedSlides.length && aiSlotsRemaining > 0; i++) {
            const slide = generatedSlides[i];
            const layout = slide.recommendedLayout ?? "";
            const isCover = slide.slideType === "cover" || layout === "hero";
            const isAiLayout = AI_PREFERRED_LAYOUTS.has(layout);
            if (isCover || isAiLayout) {
                aiSlotSet.add(i);
                aiSlotsRemaining--;
            }
        }

        const usedImageUrls = new Set<string>();
        const dalleErrors: string[] = [];
        const generatedImages: Array<{ slideIndex: number; fileName: string; viewUrl: string } | null> = [];

        const images: (string | null)[] = await Promise.all(
            generatedSlides.map(async (slide: any, index: number) => {
                if (!needsPhoto(slide)) {
                    generatedImages[index] = null;
                    return null;
                }

                if (aiSlotSet.has(index)) {
                    try {
                        const result = await generateIllustration(slide.slideType ?? "cover", slide.title ?? "", theme, slide.recommendedLayout, canvas, accentOverride, slide.visualRequirements?.searchQuery);
                        if (result) {
                            generatedImages[index] = {
                                slideIndex: index + 1,
                                fileName: result.fileName,
                                viewUrl: `http://localhost:3000${result.httpPath}`,
                            };
                            return result.fileUrl; // data URI — loads in Puppeteer with no restrictions
                        }
                    } catch (aiErr: any) {
                        const msg = aiErr?.message ?? String(aiErr);
                        console.error("[Illustration error]", msg);
                        dalleErrors.push(`Slide ${index + 1}: ${msg}`);
                    }
                }

                generatedImages[index] = null;
                const url = await getUnsplashImage(
                    slide.visualRequirements?.searchQuery ?? "business meeting",
                    slide.visualRequirements?.orientation ?? "landscape",
                    usedImageUrls
                );
                if (url) usedImageUrls.add(url);
                return url ?? null;
            })
        );

        const finalSlides = generatedSlides.map((slide: any, index: number) => ({
            ...slide,
            imageUrl: images[index],
        }));

        // Watermark badge — opt-in via { "watermark": true }. Text comes from
        // WATERMARK_TEXT in .env so it can be changed without code edits.
        const watermark = req.body.watermark === true || req.body.watermark === "true";

        const pdfPath = await generatePDF(deck.deckTitle, finalSlides, deck.storyTheme, theme, canvas, accentOverride, watermark);

        console.log("Pipeline:", Date.now() - start, "ms");

        res.status(200).json({
            deckTitle: deck.deckTitle,
            storyTheme: deck.storyTheme,
            deckType,
            theme,
            canvas,
            accentColor: accentOverride ? { name: accentOverride.name, hex: accentOverride.hex } : null,
            pdfPath,
            aiImages: generatedImages.filter(Boolean).map(img => img!.viewUrl),
            // If DALL-E failed, errors show here so you can diagnose
            dalleErrors: dalleErrors.length ? dalleErrors : undefined,
            slides: finalSlides,
        });

    } catch (error: any) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// ─── STREAMING ENGINE (Phase 0) ──────────────────────────────────────────────
// Finished decks held in memory so POST /export is stateless w.r.t. the original
// generation request. NOTE: in-process + non-persistent — the Backend service
// (Phase 2) replaces this with Postgres/object storage keyed by deckId.
interface StoredDeck {
    deckTitle: string;
    storyTheme: string;
    slides: any[];
    themeName: ReturnType<typeof resolveTheme>;
    canvas: CanvasFormat;
    accentOverride: AccentOverride | null;
    watermark: boolean;
}
const DECK_STORE = new Map<string, StoredDeck>();

// Resolve the deck-shaping inputs shared by /jobs and /generate. Returns either
// the resolved config or an error string (for callers to surface).
function resolveJobParams(body: any):
    | { error: string }
    | {
        noOfSlides: number; deckType: DeckType; themeName: ReturnType<typeof resolveTheme>;
        accentOverride: AccentOverride | null; canvas: CanvasFormat; watermark: boolean;
    } {
    if (!body.prompt && !body.topic && !body.productName) {
        return { error: "Required: prompt (e.g. { \"prompt\": \"Create a pitch deck for my AI startup\", \"noOfSlides\": 12 })" };
    }
    const noOfSlides = Math.min(Math.max(parseInt(String(body.noOfSlides ?? 15)) || 15, 5), 21);
    const deckType: DeckType = resolveDeckType(body.deckType);
    const themeName = resolveTheme(body.theme);
    const accentOverride = resolveAccentOverride(body.accentColor);
    const canvas: CanvasFormat = body.canvas
        ? resolveCanvas(body.canvas)
        : (deckType === "social_post" ? "square_1_1" : WIDESCREEN_ONLY);
    if (deckType !== "social_post" && canvas !== WIDESCREEN_ONLY) {
        return { error: `deckType "${deckType}" only supports canvas "widescreen_16_9" in this version. Use deckType "social_post" for square/vertical canvases.` };
    }
    const watermark = body.watermark === true || body.watermark === "true";
    return { noOfSlides, deckType, themeName, accentOverride, canvas, watermark };
}

// Gamma-style slide-by-slide generation over Server-Sent Events.
// Emits: outline → slide (×N, parallel emit-as-ready) → done.
app.post("/jobs", async (req, res) => {
    // SSE handshake
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // disable proxy buffering (nginx)
    (res as any).flushHeaders?.();

    const send = (event: string, data: any) => {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Heartbeat so idle proxies/load balancers don't drop the connection during
    // the long outline phase.
    const heartbeat = setInterval(() => res.write(`: ping\n\n`), 15000);
    let clientGone = false;
    // Detect a real client disconnect by listening on the RESPONSE, not the
    // request: in Express 5 the request stream emits "close" as soon as the body
    // is consumed, which would falsely flag the client as gone mid-generation.
    res.on("close", () => { if (!res.writableFinished) clientGone = true; });

    const finish = () => { clearInterval(heartbeat); res.end(); };

    try {
        const params = resolveJobParams(req.body);
        if ("error" in params) {
            send("error", { error: params.error });
            return finish();
        }
        const { noOfSlides, deckType, themeName, accentOverride, canvas, watermark } = params;

        const start = Date.now();
        const jobId = `job_${start}`;

        // Stage 1 — outline (fast). Client renders N placeholder cards immediately.
        const outline = await buildOutline(req.body, noOfSlides, deckType);
        const sortedSlides = [...outline.slides].sort((a, b) => a.slideNumber - b.slideNumber);
        if (clientGone) return finish();

        send("outline", {
            jobId,
            deckTitle: outline.deckTitle,
            storyTheme: outline.storyTheme,
            deckType,
            theme: themeName,
            canvas,
            canvasDims: CANVAS_DIMS[canvas],
            accentColor: accentOverride ? { name: accentOverride.name, hex: accentOverride.hex } : null,
            // Shared stylesheet — applied once to every streamed slide fragment.
            css: getDeckStyles(themeName, canvas, accentOverride),
            slides: sortedSlides.map((s) => ({
                slideNumber: s.slideNumber,
                title: s.title ?? "",
                layout: s.recommendedLayout ?? "",
                slideType: s.slideType ?? "",
                status: "pending",
            })),
        });

        // Stage 2 — fill all slides in parallel, emit each the moment it's ready.
        const aiSlotSet = computeAiSlotSet(sortedSlides, deckType);
        const usedImageUrls = new Set<string>();
        const finalSlides: any[] = [];

        await Promise.all(sortedSlides.map(async (outlineSlide, index) => {
            try {
                const filled = await fillSlide(outlineSlide, {
                    enrichedAnalysis: outline.enrichedAnalysis,
                    storyTheme: outline.storyTheme,
                    themeName, canvas, accentOverride, watermark,
                    isAiSlot: aiSlotSet.has(index),
                    usedImageUrls,
                });
                finalSlides[index] = filled.slide;
                if (clientGone) return;
                send("slide", {
                    slideNumber: filled.slideNumber,
                    layout: filled.layout,
                    html: filled.html,
                    imageUrl: filled.imageUrl,
                    aiImage: filled.aiImage ?? undefined,
                    status: "ready",
                });
            } catch (slideErr: any) {
                console.error("[slide error]", outlineSlide.slideNumber, slideErr?.message ?? slideErr);
                if (!clientGone) send("slide_error", {
                    slideNumber: outlineSlide.slideNumber,
                    error: slideErr?.message ?? String(slideErr),
                    status: "error",
                });
            }
        }));

        if (clientGone) return finish();

        // Persist the assembled deck so /export needs no regeneration.
        const deckId = `deck_${start}`;
        const slides = finalSlides.filter(Boolean);
        DECK_STORE.set(deckId, {
            deckTitle: outline.deckTitle,
            storyTheme: outline.storyTheme,
            slides,
            themeName, canvas, accentOverride, watermark,
        });

        send("done", { jobId, deckId, slideCount: slides.length, ms: Date.now() - start });
    } catch (error: any) {
        console.error(error);
        if (!clientGone) send("error", { error: error?.message ?? String(error) });
    } finally {
        finish();
    }
});

// Deliberate, on-demand export of an already-generated deck. PDF for now;
// pptx / gslides land in Phase 3.
app.post("/export", async (req, res) => {
    try {
        const { deckId, format = "pdf" } = req.body;
        const deck = deckId ? DECK_STORE.get(deckId) : undefined;
        if (!deck) {
            return res.status(404).json({ error: "Unknown or expired deckId. Generate a deck via POST /jobs first." });
        }
        if (format !== "pdf") {
            return res.status(400).json({ error: `Export format "${format}" not implemented yet. Supported: pdf.` });
        }
        const pdfPath = await generatePDF(
            deck.deckTitle, deck.slides, deck.storyTheme,
            deck.themeName, deck.canvas, deck.accentOverride, deck.watermark,
        );
        res.status(200).json({ deckId, format, pdfPath });
    } catch (error: any) {
        res.status(500).json({ error: error?.message ?? String(error) });
    }
});

app.get("/test-unsplash", async (req, res) => {
    try {
        const image = await getUnsplashImage("office");
        res.json({ image });
    } catch (error: any) {
        res.json({ error: error.message });
    }
});

// Quick test: hit this to check if DALL-E is accessible on your account
app.get("/test-dalle", async (req, res) => {
    try {
        const result = await generateIllustration("cover", "Test illustration");
        res.json({
            success: true,
            fileName: result?.fileName,
            viewUrl: result ? `http://localhost:3000${result.httpPath}` : null,
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error?.message ?? String(error),
            hint: "Check your OPEN_AI_KEY has DALL-E 3 access and billing is active",
        });
    }
});

app.listen(8080, () => {
    console.log("Server is running at Port", 8080)
})
