/**
 * Page-builder left panel — mirrors Pagy's `<LeftPanel />` shell.
 *
 * The outer `motion.aside` is the floating `.pb-leftpanel` card.
 * It animates `x` between `16` (open) and `-100%` (closed), and
 * picks up a CSS width class (`-medium` / `-large`) based on the
 * currently-active sheet so the panel grows for wider sub-panels.
 *
 * Inside, `<AnimatePresence>` swaps sub-panel sheets through
 * `<PanelAnimator>`, which slides each one in/out from a direction
 * computed from the previous `root` in the store.
 *
 * Most sheet bodies are still placeholders. The chrome (collapse,
 * width animation, slide direction) is what's wired up here — real
 * sub-panels can drop in via the `SHEETS` table below without
 * touching the layout.
 */

import { CaretUpDown } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import type { ComponentType, ReactElement } from "react";

import { PanelAnimator } from "./PanelAnimator";
import { ColorsPanel } from "./panels/ColorsPanel";
import { DesignPanel } from "./panels/DesignPanel";
import { FontsPanel } from "./panels/FontsPanel";
import {
  navigateTo,
  usePageBuilderStore,
  type Sheet,
} from "./store";

// ────────────────────────────────────────────────────────────────
// Sheet table
// ────────────────────────────────────────────────────────────────

interface SheetDef {
  /** CSS modifier class on `.pb-panel-content` driving its width. */
  width?: "-medium" | "-large";
  /** Body of the sheet. */
  Component: ComponentType;
}

/** All sub-panel sheets registered with the LeftPanel. Adding a new
 *  sheet is one entry here — the `<AnimatePresence>` block below is
 *  data-driven. Width classes match pagy's `widthClass` ternary in
 *  `src/editor/panels/left-panel.tsx`. */
const SHEETS: Record<Sheet, SheetDef> = {
  menu: { Component: MenuSheet },
  design: { width: "-medium", Component: DesignPanel },
  colors: { width: "-medium", Component: ColorsPanel },
  fonts: { width: "-medium", Component: FontsPanel },
  pages: { width: "-medium", Component: () => <Placeholder title="Pages" /> },
  forms: { width: "-medium", Component: () => <Placeholder title="Forms" /> },
  settings: {
    width: "-medium",
    Component: () => <Placeholder title="Settings" />,
  },
  code: { width: "-large", Component: () => <Placeholder title="Code" /> },
  // Currently-unbuilt routes — present so the typed `Sheet` union
  // stays exhaustive and PanelAnimator can pick correct slide
  // directions when navigating into/out of them.
  buttons: { width: "-medium", Component: () => <Placeholder title="Buttons" /> },
  inputs: { width: "-medium", Component: () => <Placeholder title="Inputs" /> },
  cards: { width: "-medium", Component: () => <Placeholder title="Cards" /> },
  form: { width: "-medium", Component: () => <Placeholder title="Form" /> },
};

// ────────────────────────────────────────────────────────────────
// LeftPanel
// ────────────────────────────────────────────────────────────────

const NAV_ITEMS: { label: string; sheet: Sheet }[] = [
  { label: "Pages", sheet: "pages" },
  { label: "Design", sheet: "design" },
  { label: "Code", sheet: "code" },
  { label: "Forms", sheet: "forms" },
  { label: "Settings", sheet: "settings" },
];

export function LeftPanel() {
  const panelOpen = usePageBuilderStore((s) => s.panel);
  const sheet = usePageBuilderStore((s) => s.sheet);
  const def = SHEETS[sheet];

  return (
    <motion.aside
      className={panelClassName(panelOpen, def.width)}
      initial={{ x: panelOpen ? 16 : "-100%" }}
      animate={{ x: panelOpen ? 16 : "-100%" }}
      transition={{
        type: "spring",
        duration: 0.5,
        bounce: panelOpen ? 0.16 : 0,
      }}
    >
      <AnimatePresence initial={false}>
        <PanelAnimator
          key={sheet}
          id={sheet}
          className={`pb-panel-content ${def.width ?? ""}`.trim()}
        >
          {renderSheet(def.Component)}
        </PanelAnimator>
      </AnimatePresence>
    </motion.aside>
  );
}

function panelClassName(open: boolean, width: SheetDef["width"]): string {
  const parts = ["pb-leftpanel"];
  if (open) parts.push("-active");
  if (width) parts.push(width);
  return parts.join(" ");
}

function renderSheet(Component: ComponentType): ReactElement {
  return <Component />;
}

// ────────────────────────────────────────────────────────────────
// Sheets
// ────────────────────────────────────────────────────────────────

function MenuSheet() {
  return (
    <>
      <button type="button" className="pb-site-picker">
        <div className="pb-site-picker-text">
          <div className="pb-site-picker-name">
            YAG 1 <span className="pb-site-picker-plan">Free</span>
          </div>
          <div className="pb-site-picker-subdomain">yag1.pagy.site</div>
        </div>
        <CaretUpDown size={14} weight="regular" />
      </button>

      <nav className="pb-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.sheet}
            type="button"
            className="pb-nav-item"
            onClick={() => navigateTo(item.sheet)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </>
  );
}

/** Lightweight stand-in for sheets we haven't ported yet. Renders
 *  enough to verify the slide and width animations. */
function Placeholder({ title }: { title: string }) {
  return (
    <div className="pb-sheet-placeholder">
      <button
        type="button"
        className="pb-sheet-back"
        onClick={() => navigateTo("menu")}
      >
        ← Back
      </button>
      <h3>{title}</h3>
      <p className="pb-sheet-placeholder-body">
        This sheet hasn't been ported from pagy yet.
      </p>
    </div>
  );
}
