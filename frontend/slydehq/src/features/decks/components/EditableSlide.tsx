import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  SelectionToolbar,
  type ToolbarFmt,
  type ToolbarPos,
} from "./SelectionToolbar";

// Same canvas sizing as SlideFrame (engine sizes `.slide` in inches; 1in = 96px).
const DPI = 96;
const CANVAS_INCHES: Record<string, { w: number; h: number }> = {
  widescreen_16_9: { w: 13.33, h: 7.5 },
  square_1_1: { w: 7.5, h: 7.5 },
  vertical_9_16: { w: 7.5, h: 13.33 },
};

const EMPTY_FMT: ToolbarFmt = {
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  block: "p",
};

interface Props {
  html: string;
  css: string;
  canvas?: string;
  editable?: boolean;
  /** Registers a getter the parent can call to read the current (edited) HTML. */
  onReady?: (getHtml: () => string) => void;
  /** Fires on each edit (for autosave / dirty tracking). */
  onDirty?: () => void;
}

/**
 * Renders a slide and (when `editable`) makes its body contentEditable so the
 * user can edit text in place. A Gamma-style formatting toolbar floats above any
 * text selection. The parent reads the edited HTML via `onReady`.
 */
export function EditableSlide({
  html,
  css,
  canvas = "widescreen_16_9",
  editable = true,
  onReady,
  onDirty,
}: Props) {
  const dims = CANVAS_INCHES[canvas] ?? CANVAS_INCHES.widescreen_16_9;
  const canvasW = dims.w * DPI;
  const canvasH = dims.h * DPI;

  const wrapRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(0);
  const scaleRef = useRef(0);
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / canvasW);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [canvasW]);

  const srcDoc = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;}[contenteditable]{outline:none}${css}</style></head><body>${html}</body></html>`;

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const onInput = () => onDirty?.();
    const apply = () => {
      const doc = iframe.contentDocument;
      if (!doc) return;
      doc.body.setAttribute("contenteditable", editable ? "true" : "false");
      doc.body.style.cursor = editable ? "text" : "default";
      doc.body.removeEventListener("input", onInput);
      if (editable) doc.body.addEventListener("input", onInput);
      onReady?.(() => iframe.contentDocument?.body?.innerHTML ?? html);
    };
    iframe.addEventListener("load", apply);
    if (iframe.contentDocument?.readyState === "complete") apply();
    return () => iframe.removeEventListener("load", apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcDoc, editable]);

  // ── Floating selection toolbar ──
  const [pos, setPos] = useState<ToolbarPos | null>(null);
  const [fmt, setFmt] = useState<ToolbarFmt>(EMPTY_FMT);
  const savedRange = useRef<Range | null>(null);
  const suppressHide = useRef(false); // keep the toolbar up while the link input is focused

  // Read the iframe selection → position the toolbar (mapping through the scale).
  const readSelection = useCallback(() => {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    const win = iframe?.contentWindow;
    if (!iframe || !doc || !win || !editable) {
      setPos(null);
      return;
    }
    const selection = win.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      if (!suppressHide.current) setPos(null);
      return;
    }
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      if (!suppressHide.current) setPos(null);
      return;
    }
    const ifr = iframe.getBoundingClientRect();
    const s = scaleRef.current || 1;
    const topV = ifr.top + rect.top * s;
    const bottomV = ifr.top + rect.bottom * s;
    const centerX = ifr.left + (rect.left + rect.width / 2) * s;
    const leftV = Math.min(Math.max(centerX, 180), window.innerWidth - 180);
    const below = topV < 96;
    setPos({ top: below ? bottomV : topV, left: leftV, below });
    setFmt({
      bold: doc.queryCommandState("bold"),
      italic: doc.queryCommandState("italic"),
      underline: doc.queryCommandState("underline"),
      strike: doc.queryCommandState("strikeThrough"),
      block: String(doc.queryCommandValue("formatBlock") || "").toLowerCase(),
    });
  }, [editable]);

  // Attach selection listeners to the (loaded) iframe document.
  useEffect(() => {
    if (!editable) {
      setPos(null);
      return;
    }
    const iframe = iframeRef.current;
    if (!iframe) return;
    let doc: Document | null = null;
    const onBlur = () => {
      if (!suppressHide.current) setPos(null);
    };
    const attach = () => {
      doc = iframe.contentDocument;
      if (!doc) return;
      doc.addEventListener("selectionchange", readSelection);
      doc.addEventListener("mouseup", readSelection);
      doc.addEventListener("keyup", readSelection);
      doc.addEventListener("focusout", onBlur);
    };
    iframe.addEventListener("load", attach);
    if (iframe.contentDocument?.readyState === "complete") attach();
    const reposition = () => readSelection();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      iframe.removeEventListener("load", attach);
      doc?.removeEventListener("selectionchange", readSelection);
      doc?.removeEventListener("mouseup", readSelection);
      doc?.removeEventListener("keyup", readSelection);
      doc?.removeEventListener("focusout", onBlur);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [srcDoc, editable, readSelection]);

  const exec = useCallback(
    (command: string, value?: string) => {
      const doc = iframeRef.current?.contentDocument;
      if (!doc) return;
      doc.execCommand(command, false, value);
      onDirty?.();
      requestAnimationFrame(readSelection); // formatting can shift layout
    },
    [onDirty, readSelection],
  );

  const onLinkOpen = useCallback(() => {
    suppressHide.current = true;
    const sel = iframeRef.current?.contentWindow?.getSelection();
    if (sel && sel.rangeCount) savedRange.current = sel.getRangeAt(0).cloneRange();
  }, []);

  const onLinkClose = useCallback(() => {
    suppressHide.current = false;
  }, []);

  const onLink = useCallback(
    (url: string) => {
      const iframe = iframeRef.current;
      const doc = iframe?.contentDocument;
      const win = iframe?.contentWindow;
      if (!doc || !win) return;
      // Refocus + restore the selection (the link input had taken focus).
      win.focus();
      (doc.body as HTMLElement).focus();
      const sel = win.getSelection();
      if (sel && savedRange.current) {
        sel.removeAllRanges();
        sel.addRange(savedRange.current);
      }
      const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
      doc.execCommand("createLink", false, href);
      onDirty?.();
      requestAnimationFrame(readSelection);
    },
    [onDirty, readSelection],
  );

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
        ref={iframeRef}
        title="Editable slide"
        srcDoc={srcDoc}
        sandbox="allow-same-origin"
        style={{
          width: canvasW,
          height: canvasH,
          border: 0,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      />
      {editable &&
        pos &&
        createPortal(
          <SelectionToolbar
            pos={pos}
            fmt={fmt}
            exec={exec}
            onLinkOpen={onLinkOpen}
            onLinkClose={onLinkClose}
            onLink={onLink}
          />,
          document.body,
        )}
    </div>
  );
}
