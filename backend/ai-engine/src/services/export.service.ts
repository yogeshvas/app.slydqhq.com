import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import PptxGenJS from "pptxgenjs";
import JSZip from "jszip";
import { generatePDF, renderSlideHTML, getDeckStyles } from "../renderers/pdf.renderer";
import { CANVAS_DIMS, type CanvasFormat } from "../config/canvas";
import type { ThemeName } from "../config/themes";
import type { AccentOverride } from "../config/accentColors";
import type { Slide } from "../renderers/slide.types";

export interface ExportParams {
  deckTitle: string;
  slides: Slide[];
  storyTheme?: string;
  themeName: ThemeName;
  canvas: CanvasFormat;
  accentOverride: AccentOverride | null;
  watermark: boolean;
}

/** Render a deck to a PDF and return the bytes. */
export async function exportPdf(p: ExportParams): Promise<Buffer> {
  const pdfPath = await generatePDF(
    p.deckTitle,
    p.slides,
    p.storyTheme ?? "",
    p.themeName,
    p.canvas,
    p.accentOverride,
    p.watermark,
  );
  const bytes = await fs.promises.readFile(pdfPath);
  // The PDF file is a transient artefact; core uploads the bytes to storage.
  fs.promises.unlink(pdfPath).catch(() => {});
  return bytes;
}

/** Render each slide to a full-canvas PNG buffer via headless Chrome. */
async function screenshotSlides(p: ExportParams): Promise<Buffer[]> {
  const dims = CANVAS_DIMS[p.canvas];
  const css = getDeckStyles(p.themeName, p.canvas, p.accentOverride);
  const sorted = [...p.slides].sort((a, b) => a.slideNumber - b.slideNumber);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const buffers: Buffer[] = [];
  try {
    const page = await browser.newPage();
    await page.setViewport({
      width: Math.round(dims.width * 96),
      height: Math.round(dims.height * 96),
      deviceScaleFactor: 2,
    });
    for (const slide of sorted) {
      const body = renderSlideHTML(
        slide,
        p.themeName,
        p.canvas,
        p.accentOverride,
        p.watermark,
      );
      const html = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;}${css}</style></head><body>${body}</body></html>`;
      await page.setContent(html, { waitUntil: "load" });
      // Give remote images (slide photos) a beat to decode before the screenshot.
      await new Promise((r) => setTimeout(r, 350));
      buffers.push((await page.screenshot({ type: "png" })) as Buffer);
    }
  } finally {
    await browser.close();
  }
  return buffers;
}

/**
 * Render a deck to a PPTX where each slide is a full-bleed PNG of the rendered
 * HTML (pixel-identical to the PDF/preview — no per-layout re-implementation).
 */
export async function exportPptx(p: ExportParams): Promise<Buffer> {
  const dims = CANVAS_DIMS[p.canvas];
  const pngs = await screenshotSlides(p);

  const pptx = new PptxGenJS();
  // Match the slide geometry exactly so images aren't letterboxed.
  pptx.defineLayout({ name: "DECK", width: dims.width, height: dims.height });
  pptx.layout = "DECK";
  pptx.title = p.deckTitle;
  for (const buf of pngs) {
    const slide = pptx.addSlide();
    slide.addImage({
      data: `data:image/png;base64,${buf.toString("base64")}`,
      x: 0,
      y: 0,
      w: dims.width,
      h: dims.height,
    });
  }

  const base64 = (await pptx.write({ outputType: "base64" })) as string;
  return Buffer.from(base64, "base64");
}

/** Render a deck to a ZIP of one PNG per slide. */
export async function exportPngZip(p: ExportParams): Promise<Buffer> {
  const pngs = await screenshotSlides(p);
  const zip = new JSZip();
  pngs.forEach((buf, i) => {
    const n = String(i + 1).padStart(2, "0");
    zip.file(`slide-${n}.png`, buf);
  });
  return zip.generateAsync({ type: "nodebuffer" });
}
