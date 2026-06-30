import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

// Rotating tips the guide "speaks" while you edit the outline.
const TIPS = [
  "Tap ✨ Rewrite with AI on any card to redraft it — add a brief if you want.",
  "Drag the handle to reorder cards into the story you want.",
  "Change the card count, theme, or dimensions up top anytime.",
  "Empty card? Hit Generate with AI and I'll write it for you.",
  "Edit titles and bullets right here — everything's saved automatically.",
  "Happy with the outline? Hit Generate to build the deck.",
];

/**
 * A friendly presenter peeking from the bottom-right who cycles through helpful
 * tips in a speech bubble. Click him to advance to the next tip, or dismiss.
 */
export function CornerGuide() {
  const [tip, setTip] = useState(0);
  const [open, setOpen] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Auto-advance the tip every few seconds while the bubble is open.
  useEffect(() => {
    if (!open || leaving || dismissed) return;
    const t = setInterval(() => setTip((i) => (i + 1) % TIPS.length), 6000);
    return () => clearInterval(t);
  }, [open, leaving, dismissed]);

  // Close the bubble first, then slide the presenter down before unmounting.
  const dismiss = () => {
    setOpen(false);
    setLeaving(true);
  };

  if (dismissed) return null;

  return (
    <div className="pointer-events-none fixed bottom-0 left-[84px] z-30 flex select-none flex-col items-start sm:left-24">
      {/* Speech bubble */}
      <AnimatePresence mode="wait">
        {open && (
          <motion.div
            key={tip}
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="pointer-events-auto relative mb-2 ml-2 max-w-[230px] border border-indigo-100 bg-white px-3.5 py-2.5 text-[13px] leading-snug text-zinc-700 shadow-lg sm:max-w-[260px]"
          >
            <button
              type="button"
              aria-label="Dismiss tip"
              onClick={dismiss}
              className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center border border-zinc-200 bg-white text-[11px] text-zinc-400 shadow-sm transition hover:text-zinc-700"
            >
              ✕
            </button>
            <p className="m-0">
              <span className="mr-1 font-semibold text-indigo-600">Tip</span>
              {TIPS[tip]}
            </p>
            {/* Bubble tail pointing down-left toward the presenter */}
            <span className="absolute -bottom-2 left-6 h-3 w-3 rotate-45 border-b border-r border-indigo-100 bg-white" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* The presenter */}
      <motion.img
        src="/man/man_for_outline.png"
        alt=""
        aria-hidden
        initial={{ y: 120, opacity: 0 }}
        animate={leaving ? { y: 160, opacity: 0 } : { y: 0, opacity: 1 }}
        transition={
          leaving
            ? { duration: 0.4, ease: "easeIn" }
            : { type: "spring", stiffness: 120, damping: 16, delay: 0.2 }
        }
        onAnimationComplete={() => {
          if (leaving) setDismissed(true);
        }}
        onClick={() =>
          leaving ? undefined : open ? setTip((i) => (i + 1) % TIPS.length) : setOpen(true)
        }
        className="pointer-events-auto w-28 cursor-pointer drop-shadow-xl sm:w-36 lg:w-40"
      />
    </div>
  );
}
