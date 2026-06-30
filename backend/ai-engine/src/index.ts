import { urlencoded } from "body-parser"
import express from "express"
import dotenv from "dotenv"
import OpenAI from "openai"
import path from "path"
import { XMLParser } from "fast-xml-parser";
import { presentationStrategist } from "./agents/presentationStrategist";
import { layoutSelectorAgent } from "./agents/layoutSelectorAgent";
import { slideCreationAgent } from "./agents/slideCreationAgent";
import { getUnsplashImage, searchUnsplashImages } from "./services/unsplash.service";
import { generateIllustration, IMAGES_DIR } from "./services/illustration.service";
import { generatePDF, needsPhoto, getDeckStyles, renderSlideHTML } from "./renderers/pdf.renderer";
import { validateAndFixSlide, enforceLayoutVariety } from "./services/deckQA";
import { resolveDeckType, IMAGE_BUDGET, type DeckType } from "./config/deckTypes";
import { resolveTheme } from "./config/themes";
import { resolveCanvas, WIDESCREEN_ONLY, CANVAS_DIMS, type CanvasFormat } from "./config/canvas";
import { resolveAccentOverride, type AccentOverride } from "./config/accentColors";
import { buildOutline, computeAiSlotSet, fillSlide } from "./pipeline";
import { generateOutline, generateOutlineCard } from "./agents/outlineAgent";
import { slideEditAgent } from "./agents/slideEditAgent";
import { describeImage } from "./agents/imageMetaAgent";
import { exportPdf, exportPptx, exportPngZip, type ExportParams } from "./services/export.service";
import { assetUrl } from "./config/assets";

dotenv.config()

const app = express()

// Slide content / edited HTML can be a few MB (esp. legacy base64 images), so
// raise the body limit well past body-parser's 100kb default.
app.use(express.json({ limit: "25mb" }))
app.use(express.urlencoded({ limit: "25mb", extended: true }));

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

// Outline-only: generate the editable outline (titles + bullets) for review,
// before committing to full slide generation via POST /jobs.
app.post("/outline", async (req, res) => {
    try {
        const params = resolveJobParams(req.body);
        if ("error" in params) {
            return res.status(400).json({ error: params.error });
        }
        const outline = await generateOutline(req.body.prompt, params.noOfSlides, params.deckType);
        return res.status(200).json(outline);
    } catch (error: any) {
        console.error("[outline]", error?.message ?? error);
        return res.status(500).json({ error: error?.message ?? String(error) });
    }
});

// Generate ONE outline card (title + bullets) that fits an existing deck. Used by
// the review page's per-card "Generate with AI" action.
app.post("/outline/slide", async (req, res) => {
    try {
        const b = req.body ?? {};
        if (!b.prompt && !b.deckTitle) {
            return res.status(400).json({ error: "Required: prompt or deckTitle." });
        }
        const card = await generateOutlineCard({
            prompt: b.prompt ?? b.deckTitle ?? "",
            deckTitle: b.deckTitle ?? "",
            storyTheme: b.storyTheme ?? "",
            deckType: resolveDeckType(b.deckType),
            existingTitles: Array.isArray(b.existingTitles) ? b.existingTitles : [],
            position: Number(b.position) || 0,
            hint: b.hint ?? "",
        });
        return res.status(200).json(card);
    } catch (error: any) {
        console.error("[outline/slide]", error?.message ?? error);
        return res.status(500).json({ error: error?.message ?? String(error) });
    }
});

// Re-render ONE slide from an edited structured content object. Pure HTML
// generation (no images/AI) — fast, used by the editor's structured panel.
app.post("/render", (req, res) => {
    try {
        const { slide } = req.body;
        if (!slide || typeof slide !== "object") {
            return res.status(400).json({ error: "Required: slide content object." });
        }
        const themeName = resolveTheme(req.body.theme);
        const canvas: CanvasFormat = req.body.canvas ? resolveCanvas(req.body.canvas) : WIDESCREEN_ONLY;
        const accentOverride = resolveAccentOverride(req.body.accentColor);
        const watermark = req.body.watermark === true || req.body.watermark === "true";
        const html = renderSlideHTML(slide, themeName, canvas, accentOverride, watermark);
        return res.status(200).json({
            html,
            css: getDeckStyles(themeName, canvas, accentOverride),
        });
    } catch (error: any) {
        console.error("[render]", error?.message ?? error);
        return res.status(500).json({ error: error?.message ?? String(error) });
    }
});

// AI-edit ONE slide from a natural-language instruction (and/or a target layout).
// Returns the revised structured content + re-rendered HTML.
app.post("/slide/edit", async (req, res) => {
    try {
        const { slide, instruction, layout } = req.body;
        if (!slide || typeof slide !== "object") {
            return res.status(400).json({ error: "Required: slide content object." });
        }
        if ((!instruction || !String(instruction).trim()) && !layout) {
            return res.status(400).json({ error: "Required: instruction and/or layout." });
        }

        const themeName = resolveTheme(req.body.theme);
        const canvas: CanvasFormat = req.body.canvas ? resolveCanvas(req.body.canvas) : WIDESCREEN_ONLY;
        const accentOverride = resolveAccentOverride(req.body.accentColor);
        const watermark = req.body.watermark === true || req.body.watermark === "true";

        // AI edit (anti-hallucination prompt), then deterministic QA hydration so
        // a layout change always has its required data fields filled.
        const deckContext = req.body.deckContext ?? {};
        let edited = await slideEditAgent({
            slide,
            instruction: String(instruction ?? ""),
            targetLayout: layout,
            deckContext,
        });
        const editAnalysis = {
            _userPrompt: deckContext.deckTitle ?? "",
            topicSummary: deckContext.storyTheme ?? deckContext.deckTitle ?? "",
        };
        edited = await validateAndFixSlide(edited, editAnalysis, deckContext.storyTheme ?? edited.storyTheme ?? "");

        // Safety net: if the edit landed on an image layout but the slide has no
        // image, auto-fill a (free) Unsplash photo so it never renders empty.
        if (needsPhoto(edited) && !edited.imageUrl) {
            try {
                const query = edited.visualRequirements?.searchQuery
                    || edited.title
                    || deckContext.deckTitle
                    || "business";
                const url = await getUnsplashImage(
                    query,
                    edited.visualRequirements?.orientation ?? "landscape",
                    new Set<string>()
                );
                if (url) edited.imageUrl = url;
            } catch (imgErr: any) {
                console.error("[slide/edit auto-image]", imgErr?.message ?? imgErr);
            }
        }

        const html = renderSlideHTML(edited, themeName, canvas, accentOverride, watermark);
        return res.status(200).json({
            slide: edited,
            html,
            css: getDeckStyles(themeName, canvas, accentOverride),
        });
    } catch (error: any) {
        console.error("[slide/edit]", error?.message ?? error);
        return res.status(500).json({ error: error?.message ?? String(error) });
    }
});

// Search stock photos — returns several options for the editor's picker.
app.post("/images/search", async (req, res) => {
    try {
        const { query, orientation = "landscape", count = 6 } = req.body ?? {};
        if (!query || !String(query).trim()) {
            return res.status(400).json({ error: "Required: a search query." });
        }
        const images = await searchUnsplashImages(
            String(query),
            String(orientation),
            Math.min(Math.max(parseInt(String(count)) || 6, 1), 12),
        );
        return res.status(200).json({ images });
    } catch (error: any) {
        console.error("[images/search]", error?.message ?? error);
        return res.status(500).json({ error: error?.message ?? String(error) });
    }
});

// Describe an image (vision) → searchable metadata for the media library.
app.post("/image/describe", async (req, res) => {
    try {
        const { imageUrl } = req.body ?? {};
        if (!imageUrl || !String(imageUrl).trim()) {
            return res.status(400).json({ error: "Required: imageUrl." });
        }
        const meta = await describeImage(String(imageUrl));
        return res.status(200).json(meta);
    } catch (error: any) {
        console.error("[image/describe]", error?.message ?? error);
        return res.status(500).json({ error: error?.message ?? String(error) });
    }
});

// Replace ONE slide's image — a chosen stock URL, an AI illustration, or an
// auto-picked Unsplash photo from a prompt.
app.post("/slide/image", async (req, res) => {
    try {
        const { slide, prompt, source = "ai", imageUrl: chosenUrl } = req.body;
        if (!slide || typeof slide !== "object") {
            return res.status(400).json({ error: "Required: slide content object." });
        }
        if (!chosenUrl && (!prompt || !String(prompt).trim())) {
            return res.status(400).json({ error: "Required: an image prompt or a chosen image URL." });
        }

        const themeName = resolveTheme(req.body.theme);
        const canvas: CanvasFormat = req.body.canvas ? resolveCanvas(req.body.canvas) : WIDESCREEN_ONLY;
        const accentOverride = resolveAccentOverride(req.body.accentColor);
        const watermark = req.body.watermark === true || req.body.watermark === "true";

        let imageUrl: string | null = null;
        if (chosenUrl) {
            // User picked a specific stock photo — use it directly, no search.
            imageUrl = String(chosenUrl);
        } else if (source === "unsplash") {
            const orientation = slide.visualRequirements?.orientation ?? "landscape";
            imageUrl = await getUnsplashImage(String(prompt), orientation, new Set());
        } else {
            const result = await generateIllustration(
                slide.slideType ?? "content", slide.title ?? "", themeName,
                slide.recommendedLayout, canvas, accentOverride, String(prompt),
            );
            // URL reference (not base64) so the edited slide HTML stays small.
            imageUrl = result?.httpPath ? assetUrl(result.httpPath) : null;
        }
        if (!imageUrl) {
            return res.status(502).json({ error: "Couldn't generate an image. Try a different prompt." });
        }

        const updated = { ...slide, imageUrl };
        const html = renderSlideHTML(updated, themeName, canvas, accentOverride, watermark);
        return res.status(200).json({ slide: updated, html, imageUrl });
    } catch (error: any) {
        console.error("[slide/image]", error?.message ?? error);
        return res.status(500).json({ error: error?.message ?? String(error) });
    }
});

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
                    // Full structured content so the backend can persist it for editing.
                    content: filled.slide,
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

// Stateless, on-demand export. Core sends the deck's slides + meta inline (no
// reliance on the in-memory DECK_STORE, which only holds the current session's
// decks) and gets back the file BYTES, which core uploads to object storage.
// Falls back to DECK_STORE by deckId for the legacy/same-session path.
app.post("/export", async (req, res) => {
    try {
        const format: string = req.body.format ?? "pdf";
        if (!["pdf", "pptx", "png"].includes(format)) {
            return res.status(400).json({ error: `Export format "${format}" not supported. Use pdf, pptx or png.` });
        }

        // Prefer inline slides (the persisted path); fall back to DECK_STORE.
        let params: ExportParams | null = null;
        if (Array.isArray(req.body.slides) && req.body.slides.length) {
            params = {
                deckTitle: String(req.body.deckTitle ?? "Untitled deck"),
                slides: req.body.slides,
                storyTheme: req.body.storyTheme ?? "",
                themeName: resolveTheme(req.body.theme),
                canvas: req.body.canvas ? resolveCanvas(req.body.canvas) : WIDESCREEN_ONLY,
                accentOverride: resolveAccentOverride(req.body.accentColor),
                watermark: req.body.watermark === true || req.body.watermark === "true",
            };
        } else if (req.body.deckId) {
            const deck = DECK_STORE.get(req.body.deckId);
            if (deck) {
                params = {
                    deckTitle: deck.deckTitle, slides: deck.slides, storyTheme: deck.storyTheme,
                    themeName: deck.themeName, canvas: deck.canvas,
                    accentOverride: deck.accentOverride, watermark: deck.watermark,
                };
            }
        }
        if (!params) {
            return res.status(400).json({ error: "Required: slides[] (or a known deckId)." });
        }

        const bytes =
            format === "pptx" ? await exportPptx(params)
            : format === "png" ? await exportPngZip(params)
            : await exportPdf(params);
        const contentType =
            format === "pptx" ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
            : format === "png" ? "application/zip"
            : "application/pdf";
        res.setHeader("Content-Type", contentType);
        return res.status(200).send(bytes);
    } catch (error: any) {
        console.error("[export]", error?.message ?? error);
        return res.status(500).json({ error: error?.message ?? String(error) });
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
