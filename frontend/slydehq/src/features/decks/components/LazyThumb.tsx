import { useEffect, useRef, useState } from "react";
import { FileTextOutlined } from "@ant-design/icons";
import { SlideFrame } from "./SlideFrame";

interface Props {
  /** Static slide-1 thumbnail image (preferred — tiny, no iframe). */
  thumbnailUrl?: string | null;
  /** Fallback: slide-1 HTML + deck CSS, rendered live (decks without an image yet). */
  html?: string | null;
  css?: string;
  canvas?: string;
}

/**
 * A deck's slide-1 thumbnail. Prefers a pre-rendered static image (`thumbnailUrl`)
 * — a single lazy <img>, so a long list stays light. Only decks that don't have an
 * image yet fall back to a live iframe, mounted just before it scrolls into view.
 */
export function LazyThumb({ thumbnailUrl, html, css, canvas }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  // The IO is only needed for the heavy iframe fallback; skip it when we have an
  // image (native lazy-loading handles that).
  useEffect(() => {
    if (thumbnailUrl) return;
    const el = ref.current;
    if (!el || visible) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px" }, // warm up just before it scrolls in
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible, thumbnailUrl]);

  return (
    <div
      ref={ref}
      className="aspect-video w-full overflow-hidden border-b border-zinc-100 bg-white"
    >
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : visible && html ? (
        <SlideFrame html={html} css={css ?? ""} canvas={canvas} />
      ) : (
        <div className="grid h-full place-items-center bg-gradient-to-br from-zinc-100 to-zinc-200 text-zinc-400">
          <FileTextOutlined style={{ fontSize: 24 }} />
        </div>
      )}
    </div>
  );
}
