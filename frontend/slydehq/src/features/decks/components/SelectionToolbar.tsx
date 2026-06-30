import { useState, type MouseEvent, type ReactNode } from "react";
import {
  AlignCenterOutlined,
  AlignLeftOutlined,
  AlignRightOutlined,
  BoldOutlined,
  ClearOutlined,
  ItalicOutlined,
  LinkOutlined,
  OrderedListOutlined,
  StrikethroughOutlined,
  UnderlineOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";

export interface ToolbarPos {
  top: number;
  left: number;
  below: boolean;
}
export interface ToolbarFmt {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  block: string; // "h1" | "h2" | "h3" | "p" | ""
}

interface Props {
  pos: ToolbarPos;
  fmt: ToolbarFmt;
  /** Run a contentEditable command on the slide's iframe selection. */
  exec: (command: string, value?: string) => void;
  /** Called when the link input opens (parent saves + protects the selection). */
  onLinkOpen: () => void;
  /** Called when the link input closes (apply or cancel). */
  onLinkClose: () => void;
  /** Apply a link to the saved selection. */
  onLink: (url: string) => void;
}

const COLORS = ["#18181b", "#4F46E5", "#dc2626", "#16a34a", "#d97706", "#0891b2"];
const HEADINGS: [tag: string, label: string][] = [
  ["p", "¶"],
  ["h1", "H1"],
  ["h2", "H2"],
  ["h3", "H3"],
];

/**
 * Gamma-style floating formatting toolbar shown above a text selection. Every
 * control fires on `mousedown` with `preventDefault()` so the slide iframe keeps
 * its selection/focus (a normal click would blur it and collapse the range).
 */
export function SelectionToolbar({
  pos,
  fmt,
  exec,
  onLinkOpen,
  onLinkClose,
  onLink,
}: Props) {
  const [linkMode, setLinkMode] = useState(false);
  const [url, setUrl] = useState("");

  // preventDefault keeps focus in the iframe; then run the action.
  const hold = (fn: () => void) => (e: MouseEvent) => {
    e.preventDefault();
    fn();
  };

  const closeLink = () => {
    setLinkMode(false);
    setUrl("");
    onLinkClose();
  };

  const block =
    fmt.block === "h1" || fmt.block === "h2" || fmt.block === "h3"
      ? fmt.block
      : "p";

  return (
    <div
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        zIndex: 1000,
        transform: pos.below
          ? "translate(-50%, 8px)"
          : "translate(-50%, calc(-100% - 8px))",
      }}
      className="flex items-center gap-0.5 border border-zinc-200 bg-white px-1 py-1 shadow-lg"
    >
      {linkMode ? (
        <form
          className="flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (url.trim()) onLink(url.trim());
            closeLink();
          }}
        >
          <input
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a link, then Enter"
            className="h-7 w-56 border border-zinc-200 px-2 text-[13px] outline-none"
          />
          <button type="submit" className="h-7 px-2 text-[12px] font-medium text-indigo-600">
            Apply
          </button>
          <button
            type="button"
            onMouseDown={hold(closeLink)}
            className="h-7 px-2 text-[12px] text-zinc-400 hover:text-zinc-600"
          >
            Cancel
          </button>
        </form>
      ) : (
        <>
          {HEADINGS.map(([tag, label]) => (
            <Btn
              key={tag}
              active={block === tag}
              onTrigger={hold(() =>
                exec("formatBlock", tag === "p" ? "P" : tag.toUpperCase()),
              )}
            >
              <span className="px-0.5 text-[12px] font-semibold">{label}</span>
            </Btn>
          ))}
          <Sep />
          <Btn active={fmt.bold} onTrigger={hold(() => exec("bold"))}>
            <BoldOutlined />
          </Btn>
          <Btn active={fmt.italic} onTrigger={hold(() => exec("italic"))}>
            <ItalicOutlined />
          </Btn>
          <Btn active={fmt.underline} onTrigger={hold(() => exec("underline"))}>
            <UnderlineOutlined />
          </Btn>
          <Btn active={fmt.strike} onTrigger={hold(() => exec("strikeThrough"))}>
            <StrikethroughOutlined />
          </Btn>
          <Sep />
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Text color ${c}`}
              onMouseDown={hold(() => exec("foreColor", c))}
              className="h-5 w-5 rounded-full border border-zinc-200 transition-transform hover:scale-110"
              style={{ background: c }}
            />
          ))}
          <Sep />
          <Btn onTrigger={hold(() => exec("insertUnorderedList"))}>
            <UnorderedListOutlined />
          </Btn>
          <Btn onTrigger={hold(() => exec("insertOrderedList"))}>
            <OrderedListOutlined />
          </Btn>
          <Sep />
          <Btn onTrigger={hold(() => exec("justifyLeft"))}>
            <AlignLeftOutlined />
          </Btn>
          <Btn onTrigger={hold(() => exec("justifyCenter"))}>
            <AlignCenterOutlined />
          </Btn>
          <Btn onTrigger={hold(() => exec("justifyRight"))}>
            <AlignRightOutlined />
          </Btn>
          <Sep />
          <Btn
            onTrigger={hold(() => {
              onLinkOpen();
              setLinkMode(true);
            })}
          >
            <LinkOutlined />
          </Btn>
          <Btn onTrigger={hold(() => exec("removeFormat"))}>
            <ClearOutlined />
          </Btn>
        </>
      )}
    </div>
  );
}

function Btn({
  active,
  onTrigger,
  children,
}: {
  active?: boolean;
  onTrigger: (e: MouseEvent) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={onTrigger}
      className={`grid h-7 min-w-7 place-items-center px-1 text-[14px] transition-colors ${
        active
          ? "bg-indigo-50 text-indigo-600"
          : "text-zinc-600 hover:bg-zinc-100"
      }`}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span className="mx-0.5 h-5 w-px bg-zinc-200" />;
}
