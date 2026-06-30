import { useLayoutEffect, useRef, useState } from "react";

// The ai-engine sizes each `.slide` in inches (CSS in = 96px). We render the
// slide at its true pixel size inside an iframe, then scale that iframe down to
// the container width so it always fits while preserving the canvas aspect.
const DPI = 96;
const CANVAS_INCHES: Record<string, { w: number; h: number }> = {
  widescreen_16_9: { w: 13.33, h: 7.5 },
  square_1_1: { w: 7.5, h: 7.5 },
  vertical_9_16: { w: 7.5, h: 13.33 },
};

interface Props {
  html: string;
  css: string;
  canvas?: string;
}

export function SlideFrame({ html, css, canvas = "widescreen_16_9" }: Props) {
  const dims = CANVAS_INCHES[canvas] ?? CANVAS_INCHES.widescreen_16_9;
  const canvasW = dims.w * DPI;
  const canvasH = dims.h * DPI;

  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / canvasW);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [canvasW]);

  const srcDoc = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;}${css}</style></head><body>${html}</body></html>`;

  return (
    <div
      ref={wrapRef}
      className="relative w-full overflow-hidden bg-white"
      style={{
        height: scale ? canvasH * scale : undefined,
        aspectRatio: scale ? undefined : `${canvasW} / ${canvasH}`,
      }}
    >
      <iframe
        title="Slide preview"
        srcDoc={srcDoc}
        sandbox=""
        scrolling="no"
        style={{
          width: canvasW,
          height: canvasH,
          border: 0,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
