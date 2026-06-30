import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { paths } from "@/routes/paths";
import {
  SUGGESTIONS,
  useSuggestionPrefs,
  type Suggestion,
} from "../suggestions";

/**
 * A friendly guide who slides up from the bottom-right of the dashboard and offers
 * a rotating suggestion in a speech bubble. A fresh suggestion leads off every
 * visit (seed-based), actionable ones start the create flow, and he can be
 * dismissed for the session or disabled entirely from Settings.
 */
export function DashboardGuide() {
  const navigate = useNavigate();
  const enabled = useSuggestionPrefs((s) => s.enabled);
  const bumpSeed = useSuggestionPrefs((s) => s.bumpSeed);
  // Capture the seed ONCE for this visit (don't subscribe — avoids a re-render
  // flash when we bump it for next time).
  const [visitSeed] = useState(() => useSuggestionPrefs.getState().seed);

  // Rotation seeded by the visit counter, so each login leads with a different
  // suggestion (not the same one every time).
  const order = useMemo(() => {
    const idx = SUGGESTIONS.map((_, i) => i);
    const start = visitSeed % SUGGESTIONS.length;
    return [...idx.slice(start), ...idx.slice(0, start)];
  }, [visitSeed]);

  const [pos, setPos] = useState(0);
  const [open, setOpen] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Advance the persisted seed once per mount so next visit starts elsewhere.
  useEffect(() => {
    bumpSeed();
  }, [bumpSeed]);

  // Auto-cycle suggestions while the bubble is open.
  useEffect(() => {
    if (!open || leaving || dismissed) return;
    const t = setInterval(() => setPos((i) => (i + 1) % order.length), 7000);
    return () => clearInterval(t);
  }, [open, leaving, dismissed, order.length]);

  if (!enabled || dismissed) return null;

  const suggestion: Suggestion = SUGGESTIONS[order[pos]];

  const dismiss = () => {
    setOpen(false);
    setLeaving(true);
  };

  const act = () => {
    if (suggestion.prompt) {
      navigate(paths.createGenerate, { state: { prompt: suggestion.prompt } });
    } else {
      setPos((i) => (i + 1) % order.length);
    }
  };

  return (
    <div className="pointer-events-none fixed bottom-0 right-4 z-30 flex select-none flex-col items-end sm:right-8">
      {/* Speech bubble */}
      <AnimatePresence mode="wait">
        {open && (
          <motion.div
            key={pos}
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="pointer-events-auto relative mb-2 mr-6 max-w-[240px] rounded-2xl border border-indigo-100 bg-white px-3.5 py-2.5 text-[13px] leading-snug text-zinc-700 shadow-lg sm:max-w-[270px]"
          >
            <button
              type="button"
              aria-label="Dismiss suggestion"
              onClick={dismiss}
              className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full border border-zinc-200 bg-white text-[11px] text-zinc-400 shadow-sm transition hover:text-zinc-700"
            >
              ✕
            </button>
            <p className="m-0">
              <span className="mr-1 font-semibold text-indigo-600">Idea</span>
              {suggestion.text}
            </p>
            {suggestion.prompt && (
              <button
                type="button"
                onClick={act}
                className="mt-1.5 text-[12px] font-semibold text-indigo-600 transition hover:text-indigo-700"
              >
                Try it →
              </button>
            )}
            {/* Tail pointing down toward the guide */}
            <span className="absolute -bottom-2 right-8 h-3 w-3 rotate-45 rounded-br-sm border-b border-r border-indigo-100 bg-white" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* The guide */}
      <motion.img
        src="/man/suggesting_man.png"
        alt=""
        aria-hidden
        initial={{ y: 140, opacity: 0 }}
        animate={leaving ? { y: 180, opacity: 0 } : { y: 0, opacity: 1 }}
        transition={
          leaving
            ? { duration: 0.4, ease: "easeIn" }
            : { type: "spring", stiffness: 120, damping: 16, delay: 0.3 }
        }
        onAnimationComplete={() => {
          if (leaving) setDismissed(true);
        }}
        onClick={() =>
          leaving ? undefined : open ? act() : setOpen(true)
        }
        className="pointer-events-auto w-28 cursor-pointer drop-shadow-xl sm:w-32 lg:w-36"
      />
    </div>
  );
}
