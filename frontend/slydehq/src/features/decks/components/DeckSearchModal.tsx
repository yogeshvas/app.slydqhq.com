import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  FileTextOutlined,
  SearchOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { Spin } from "antd";
import { AnimatePresence, motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { deckPath } from "@/routes/paths";
import { timeAgo } from "@/lib/utils";
import { SlideFrame } from "./SlideFrame";
import { useDeckSearch, useRecentDecks } from "../hooks/use-decks";
import type { DeckSummary } from "../types/deck.types";

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Gamma-style "Jump to" command palette (⌘K). Centered, ~half-screen, slides up
 * from the bottom. Searches decks by title + content server-side and shows a
 * thumbnail, creator, and last-viewed/updated time.
 */
export function DeckSearchModal({ open, onClose }: Props) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [active, setActive] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 220);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (open) {
      setQ("");
      setDebounced("");
      setActive(0);
    }
  }, [open]);

  const { data: searchResults = [], isFetching, isError } =
    useDeckSearch(debounced);
  // When nothing is typed, suggest the latest decks.
  const { data: recent = [] } = useRecentDecks(open && !debounced);

  const showingRecent = !debounced;
  const results: DeckSummary[] = showingRecent ? recent : searchResults;

  useEffect(() => setActive(0), [debounced, recent.length]);

  const go = (id: string) => {
    onClose();
    navigate(deckPath(id));
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
      } else if (e.key === "Enter" && results[active]) {
        go(results[active]._id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, results, active, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[1500] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            className="flex max-h-[70vh] w-[clamp(480px,50vw,760px)] max-w-[94vw] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 80, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 60, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 460, damping: 34 }}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3.5">
              <SearchOutlined className="text-[18px] text-zinc-400" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Jump to… search your decks by title or content"
                className="flex-1 bg-transparent text-[16px] text-zinc-800 outline-none placeholder:text-zinc-400"
              />
              {isFetching && <Spin size="small" />}
              <kbd className="hidden border border-zinc-200 px-1.5 py-0.5 text-[11px] text-zinc-400 sm:inline">
                Esc
              </kbd>
            </div>

            {/* Results */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {showingRecent && results.length > 0 && (
                <div className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                  Recent
                </div>
              )}
              {showingRecent && results.length === 0 ? (
                <p className="px-4 py-12 text-center text-[13px] text-zinc-400">
                  Start typing to search your decks.
                </p>
              ) : isError ? (
                <div className="px-4 py-12 text-center text-[13px] text-amber-600">
                  <WarningOutlined className="mb-1 block text-[20px]" />
                  Couldn’t reach search. If you just added it, restart the backend.
                </div>
              ) : !showingRecent && results.length === 0 && !isFetching ? (
                <p className="px-4 py-12 text-center text-[13px] text-zinc-400">
                  No decks match “{debounced}”.
                </p>
              ) : (
                results.map((d, i) => (
                  <button
                    key={d._id}
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(d._id)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      i === active ? "bg-indigo-50" : "hover:bg-zinc-50"
                    }`}
                  >
                    <div className="h-12 w-20 shrink-0 overflow-hidden border border-zinc-200 bg-zinc-50">
                      {d.thumbnailHtml ? (
                        <SlideFrame
                          html={d.thumbnailHtml}
                          css={d.styleCss ?? ""}
                          canvas={d.canvas}
                        />
                      ) : (
                        <div className="grid h-full place-items-center text-zinc-300">
                          <FileTextOutlined />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-medium text-zinc-800">
                        {d.title}
                      </div>
                      <div className="truncate text-[12px] text-zinc-500">
                        {d.creator?.name ? `Created by ${d.creator.name} · ` : ""}
                        {d.lastViewedAt
                          ? `Viewed ${timeAgo(d.lastViewedAt)}`
                          : `Updated ${timeAgo(d.updatedAt)}`}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="border-t border-zinc-100 bg-zinc-50 px-4 py-2 text-[11px] text-zinc-400">
              👋 Tip: open this anywhere with ⌘K / Ctrl+K · ↑↓ to navigate · ↵ to open
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
