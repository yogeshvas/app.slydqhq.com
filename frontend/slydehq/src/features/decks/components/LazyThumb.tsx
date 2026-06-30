import { useEffect, useRef, useState } from "react";
import { FileTextOutlined } from "@ant-design/icons";
import { SlideFrame } from "./SlideFrame";

interface Props {
  html?: string | null;
  css?: string;
  canvas?: string;
}

/**
 * Renders a deck's slide-1 thumbnail only once the card scrolls near the
 * viewport — so a long deck list doesn't mount dozens of iframes up front.
 */
export function LazyThumb({ html, css, canvas }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
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
  }, [visible]);

  return (
    <div
      ref={ref}
      className="aspect-video w-full overflow-hidden border-b border-zinc-100 bg-white"
    >
      {visible && html ? (
        <SlideFrame html={html} css={css ?? ""} canvas={canvas} />
      ) : (
        <div className="grid h-full place-items-center bg-gradient-to-br from-zinc-100 to-zinc-200 text-zinc-400">
          <FileTextOutlined style={{ fontSize: 24 }} />
        </div>
      )}
    </div>
  );
}
