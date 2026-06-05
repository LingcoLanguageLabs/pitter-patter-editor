/**
 * Page-builder canvas — the framed white card that holds the
 * ProseMirror doc. Mirrors Pagy's `.frame`:
 *
 *   • White card with rounded corners + shadow (.pb-canvas-wrap).
 *   • Top-right action pill of icons (sliders / copy / refresh).
 *
 * The "+ Add block" / "+ Add section" affordances are NOT rendered
 * here — they're added per-section via `sectionChromePlugin` (a PM
 * widget decoration), so they stay scoped to each section's chrome.
 */

import {
  ArrowClockwise,
  Copy,
  Sliders,
  type IconWeight,
} from "@phosphor-icons/react";
import type { ComponentType, ReactNode } from "react";

import { usePageBuilderStore } from "./store";

interface CanvasActionDef {
  /** React-friendly key + aria-label suffix. */
  id: string;
  Icon: ComponentType<{ size?: number; weight?: IconWeight }>;
  label: string;
  /** Optional active-state predicate. Used by the sliders button to
   *  reflect `blockPanelOpen` in the UI. */
  isActive?: (state: ReturnType<typeof usePageBuilderStore.getState>) => boolean;
  onClick?: (state: ReturnType<typeof usePageBuilderStore.getState>) => void;
}

/** Top-right action icons. Adding another button is one entry here. */
const CANVAS_ACTIONS: CanvasActionDef[] = [
  {
    id: "block-panel",
    Icon: Sliders,
    label: "Open block panel",
    isActive: (s) => s.blockPanelOpen,
    onClick: (s) => s.setBlockPanelOpen(!s.blockPanelOpen),
  },
  { id: "duplicate", Icon: Copy, label: "Duplicate page" },
  { id: "reset", Icon: ArrowClockwise, label: "Reset" },
];

export function Canvas({ children }: { children: ReactNode }) {
  const mobile = usePageBuilderStore((s) => s.mobile);
  const isDragging = usePageBuilderStore((s) => s.isDragging);

  return (
    <div className={`pb-canvas-wrap${mobile ? " -mobile" : ""}`}>
      <div className="pb-canvas site">
        <CanvasActions isDragging={isDragging} />
        <div className="pb-canvas-scroll">{children}</div>
      </div>
    </div>
  );
}

function CanvasActions({ isDragging }: { isDragging: boolean }) {
  return (
    <div
      className="pb-canvas-actions"
      data-pb-overlay
      data-dragging={isDragging || undefined}
    >
      {CANVAS_ACTIONS.map((action) => (
        <CanvasActionButton key={action.id} action={action} />
      ))}
    </div>
  );
}

function CanvasActionButton({ action }: { action: CanvasActionDef }) {
  const isActive = usePageBuilderStore((s) =>
    action.isActive ? action.isActive(s) : false,
  );
  return (
    <button
      type="button"
      className="pb-canvas-action"
      data-active={isActive || undefined}
      onClick={() =>
        action.onClick?.(usePageBuilderStore.getState())
      }
      aria-label={action.label}
    >
      <action.Icon size={16} weight="regular" />
    </button>
  );
}
