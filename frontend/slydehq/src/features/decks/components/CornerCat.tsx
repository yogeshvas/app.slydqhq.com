import { useEffect, useState } from "react";

interface Props {
  /** When false, the cat slides back down; `onExitComplete` fires after. */
  visible: boolean;
  onExitComplete?: () => void;
}

/**
 * The mascot peeking from the bottom-right. Pops UP on mount and slides DOWN
 * when `visible` goes false (drive that before navigating, then act in
 * `onExitComplete`). Driven by CSS keyframes (see index.css) for reliability.
 */
export function CornerCat({ visible, onExitComplete }: Props) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!visible) setLeaving(true);
  }, [visible]);

  return (
    <img
      src="/cat.png"
      alt=""
      aria-hidden="true"
      onAnimationEnd={() => {
        if (leaving) onExitComplete?.();
      }}
      className={`pointer-events-none fixed bottom-0 right-3 z-20 w-24 select-none drop-shadow-xl sm:w-32 lg:w-36 ${
        leaving ? "cat-drop" : "cat-pop"
      }`}
    />
  );
}
