/**
 * Sub-panel slide wrapper. Mirrors pagy.co's `oI` /
 * `src/editor/ui/panel-animator.tsx`.
 *
 * Wraps each left-panel sheet in a `motion.div` that slides in/out
 * relative to where it's coming *from*:
 *   • `x = -50%` when this panel was the previous root (we're going
 *     "back").
 *   • `x = +480` when navigating into a design-panel-sized sheet.
 *   • `x = +320` when navigating into a standard-width sheet.
 *
 * `root` in the store is what `navigateTo()` sets to the previous
 * sheet before transitioning, so the outgoing panel knows what
 * direction to exit in.
 */

import type { CSSProperties, ReactNode } from "react";
import { motion } from "motion/react";

import { usePageBuilderStore, type Sheet } from "./store";

interface PanelAnimatorProps {
  id: Sheet;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

const WIDE_ROOTS: Sheet[] = ["design", "form", "settings"];

export function PanelAnimator({
  id,
  className,
  style,
  children,
}: PanelAnimatorProps) {
  const root = usePageBuilderStore((s) => s.root);
  const isPreviousRoot = id === root;
  const wide = WIDE_ROOTS.includes(root);
  const offscreen = isPreviousRoot ? "-50%" : wide ? 480 : 320;

  return (
    <motion.div
      className={className}
      style={style}
      transition={{ type: "spring", bounce: 0, duration: 0.5 }}
      initial={{ x: offscreen, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: offscreen, opacity: 0 }}
    >
      {children}
    </motion.div>
  );
}
