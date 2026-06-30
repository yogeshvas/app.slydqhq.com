import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AimOutlined,
  CloseOutlined,
  FileTextOutlined,
  LeftOutlined,
  RightOutlined,
} from "@ant-design/icons";
import { SlideFrame } from "./SlideFrame";
import type { Slide } from "../types/deck.types";

interface Props {
  slides: Slide[];
  css: string;
  canvas?: string;
  startIndex?: number;
  onClose: () => void;
}

/**
 * Full-screen presentation. ← → / Space / click navigate, ESC exits, S toggles
 * speaker notes, L toggles a laser pointer. Reuses SlideFrame so it's
 * pixel-identical to the editor/PDF.
 */
export function PresentMode({
  slides,
  css,
  canvas,
  startIndex = 0,
  onClose,
}: Props) {
  const [i, setI] = useState(Math.min(startIndex, Math.max(slides.length - 1, 0)));
  const [showNotes, setShowNotes] = useState(false);
  const [laser, setLaser] = useState(false);

  const go = (next: number) =>
    setI(() => Math.min(Math.max(next, 0), slides.length - 1));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        setI((c) => Math.min(c + 1, slides.length - 1));
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setI((c) => Math.max(c - 1, 0));
      } else if (e.key.toLowerCase() === "s") {
        setShowNotes((v) => !v);
      } else if (e.key.toLowerCase() === "l") {
        setLaser((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slides.length, onClose]);

  // Best-effort real fullscreen; cleaned up on unmount.
  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {});
    return () => {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  // ── Laser pointer: a red glowing dot that EASES toward the cursor (lag) with a
  // soft trailing glow — like Google Slides. Animated with rAF lerp so it lingers.
  const dotRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!laser) return;
    const target = { x: innerWidth / 2, y: innerHeight / 2 };
    const dot = { x: target.x, y: target.y };
    const trail = { x: target.x, y: target.y };
    let raf = 0;
    let visible = false;

    const onMove = (e: MouseEvent) => {
      target.x = e.clientX;
      target.y = e.clientY;
      if (!visible) {
        visible = true;
        if (dotRef.current) dotRef.current.style.opacity = "1";
        if (trailRef.current) trailRef.current.style.opacity = "1";
      }
    };
    const tick = () => {
      // Dot tracks fairly tightly; trail lags more for the soft "comet" shadow.
      dot.x += (target.x - dot.x) * 0.35;
      dot.y += (target.y - dot.y) * 0.35;
      trail.x += (target.x - trail.x) * 0.12;
      trail.y += (target.y - trail.y) * 0.12;
      if (dotRef.current) {
        dotRef.current.style.transform = `translate(${dot.x}px, ${dot.y}px) translate(-50%, -50%)`;
      }
      if (trailRef.current) {
        trailRef.current.style.transform = `translate(${trail.x}px, ${trail.y}px) translate(-50%, -50%)`;
      }
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener("mousemove", onMove);
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [laser]);

  const current = slides[i];
  const notes = current?.notes?.trim();

  const ctrlBtn =
    "grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white/90 backdrop-blur-md transition hover:bg-white/20 disabled:opacity-25";

  return createPortal(
    <div
      className={`fixed inset-0 z-[2000] flex flex-col bg-black ${
        laser ? "cursor-none" : ""
      }`}
    >
      {/* Top controls */}
      <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setLaser((v) => !v)}
          className={`grid h-9 w-9 place-items-center rounded-full text-white/80 transition hover:bg-white/10 ${
            laser ? "!bg-red-500/80 !text-white" : ""
          }`}
          title="Laser pointer (L)"
        >
          <AimOutlined />
        </button>
        <button
          type="button"
          onClick={() => setShowNotes((v) => !v)}
          className={`grid h-9 w-9 place-items-center rounded-full text-white/80 transition hover:bg-white/10 ${
            showNotes ? "bg-white/15" : ""
          }`}
          title="Speaker notes (S)"
        >
          <FileTextOutlined />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="grid h-9 w-9 place-items-center rounded-full text-white/80 transition hover:bg-white/10"
          title="Exit (Esc)"
        >
          <CloseOutlined />
        </button>
      </div>

      {/* Slide stage */}
      <div className="flex min-h-0 flex-1 items-center justify-center p-6">
        <div className="w-full max-w-[min(100%,calc((100vh-7rem)*16/9))]">
          {current && (
            <div className="overflow-hidden shadow-2xl">
              <SlideFrame html={current.html} css={css} canvas={canvas} />
            </div>
          )}
        </div>
      </div>

      {/* Speaker notes */}
      {showNotes && (
        <div className="max-h-[28vh] overflow-y-auto border-t border-white/10 bg-zinc-950 px-8 py-4 text-[15px] leading-relaxed text-zinc-200">
          {notes ? (
            <p className="whitespace-pre-wrap">{notes}</p>
          ) : (
            <p className="text-zinc-500">No notes for this slide.</p>
          )}
        </div>
      )}

      {/* Floating glassy nav — translucent prev/next */}
      <div className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3">
        <button
          type="button"
          onClick={() => go(i - 1)}
          disabled={i === 0}
          className={ctrlBtn}
          title="Previous (←)"
        >
          <LeftOutlined />
        </button>
        <span className="rounded-full bg-white/10 px-3 py-1 text-[13px] tabular-nums text-white/90 backdrop-blur-md">
          {i + 1} / {slides.length}
        </span>
        <button
          type="button"
          onClick={() => go(i + 1)}
          disabled={i === slides.length - 1}
          className={ctrlBtn}
          title="Next (→)"
        >
          <RightOutlined />
        </button>
      </div>

      {/* Click zones for prev/next (kept under the controls; disabled in laser mode
          so pointing doesn't flip slides) */}
      {!laser && (
        <>
          <button
            type="button"
            aria-label="Previous slide"
            onClick={() => go(i - 1)}
            className="absolute inset-y-0 left-0 w-1/4 cursor-w-resize"
          />
          <button
            type="button"
            aria-label="Next slide"
            onClick={() => go(i + 1)}
            className="absolute inset-y-0 right-0 w-1/4 cursor-e-resize"
          />
        </>
      )}

      {/* Laser pointer — soft trailing glow + crisp red dot */}
      {laser && (
        <>
          <div
            ref={trailRef}
            className="pointer-events-none fixed left-0 top-0 z-[2100] h-8 w-8 rounded-full opacity-0"
            style={{
              background:
                "radial-gradient(circle, rgba(239,68,68,0.55) 0%, rgba(239,68,68,0) 70%)",
              filter: "blur(2px)",
            }}
          />
          <div
            ref={dotRef}
            className="pointer-events-none fixed left-0 top-0 z-[2101] h-3.5 w-3.5 rounded-full opacity-0"
            style={{
              background:
                "radial-gradient(circle at 35% 35%, #fca5a5 0%, #ef4444 55%, #b91c1c 100%)",
              boxShadow:
                "0 0 8px 3px rgba(239,68,68,0.7), 0 0 18px 6px rgba(239,68,68,0.35)",
            }}
          />
        </>
      )}
    </div>,
    document.body,
  );
}
