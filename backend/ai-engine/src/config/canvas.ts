export type CanvasFormat = "widescreen_16_9" | "square_1_1" | "vertical_9_16";

export interface CanvasDims {
  width: number;  // inches
  height: number; // inches
}

// "widescreen_16_9" reproduces today's hardcoded pdf.renderer.ts page size exactly — it's the default.
export const CANVAS_DIMS: Record<CanvasFormat, CanvasDims> = {
  widescreen_16_9: { width: 13.33, height: 7.5 },
  square_1_1:      { width: 7.5,   height: 7.5 },
  vertical_9_16:   { width: 7.5,   height: 13.33 },
};

// Layouts designed for the legacy 16:9 geometry (side-by-side splits, 2x2 grids) only
// support this canvas. The new social_* layouts are centered-flex and canvas-agnostic.
export const WIDESCREEN_ONLY: CanvasFormat = "widescreen_16_9";

export function resolveCanvas(canvas?: string): CanvasFormat {
  return canvas && canvas in CANVAS_DIMS ? (canvas as CanvasFormat) : "widescreen_16_9";
}
