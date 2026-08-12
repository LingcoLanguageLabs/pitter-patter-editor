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

import { AnimatePresence, motion } from "motion/react";
import { useEffect, type ComponentType, type ReactElement } from "react";

import { PanelAnimator } from "./PanelAnimator";
import { SitePicker } from "./SitePicker";
import { ButtonsPanel } from "./panels/ButtonsPanel";
import { ColorsPanel } from "./panels/ColorsPanel";
import { DesignPanel } from "./panels/DesignPanel";
import { FontsPanel } from "./panels/FontsPanel";
import { InputsPanel } from "./panels/InputsPanel";
import { LayersPanel } from "./panels/LayersPanel";
import { PagesPanel } from "./panels/PagesPanel";
import { PhotosPanel } from "./panels/PhotosPanel";
import { SettingsPanel } from "./panels/SettingsPanel";
import { TransitionsPanel } from "./panels/TransitionsPanel";
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
  pages: { width: "-medium", Component: PagesPanel },
  layers: { width: "-medium", Component: LayersPanel },
  transitions: { width: "-medium", Component: TransitionsPanel },
  settings: { width: "-medium", Component: SettingsPanel },
  code: { width: "-large", Component: () => <Placeholder title="Code" /> },
  buttons: { width: "-medium", Component: ButtonsPanel },
  inputs: { width: "-medium", Component: InputsPanel },
  photos: { width: "-large", Component: PhotosPanel },
  // Currently-unbuilt routes — present so the typed `Sheet` union
  // stays exhaustive and PanelAnimator can pick correct slide
  // directions when navigating into/out of them.
  cards: { width: "-medium", Component: () => <Placeholder title="Cards" /> },
  form: { width: "-medium", Component: () => <Placeholder title="Form" /> },
};

// ────────────────────────────────────────────────────────────────
// LeftPanel
// ────────────────────────────────────────────────────────────────

const NAV_ITEMS: { label: string; sheet: Sheet }[] = [
  { label: "Pages", sheet: "pages" },
  { label: "Layers", sheet: "layers" },
  { label: "Design", sheet: "design" },
  { label: "Code", sheet: "code" },
  { label: "Settings", sheet: "settings" },
];
// Note: "photos" is intentionally NOT in the nav. The Photos sheet is reached
// only on demand — the "Unsplash" catalog block opens it via the auto-reveal
// effect below; it stays registered in SHEETS so that navigation works.

export function LeftPanel() {
  const panelOpen = usePageBuilderStore((s) => s.panel);
  const sheet = usePageBuilderStore((s) => s.sheet);
  const def = SHEETS[sheet];

  // The "Unsplash" catalog block opens the picker by setting `unsplash.open`
  // (mirrored from the editor plugin). Reveal the Photos sheet when that flips
  // true — the picker UI lives here, outside the editor context.
  const pickerOpen = usePageBuilderStore((s) => s.unsplash.open);
  const setPanel = usePageBuilderStore((s) => s.setPanel);
  useEffect(() => {
    if (!pickerOpen) return;
    setPanel(true);
    navigateTo("photos");
  }, [pickerOpen, setPanel]);

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
      <SitePicker />

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
