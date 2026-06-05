/**
 * Page-builder UI store.
 *
 * Holds chrome state (left panel open/closed, current sub-panel,
 * desktop vs mobile preview, drag-in-progress flag) plus the
 * currently-applied site theme. Selection + hover are NOT here —
 * shuffle's plugin already tracks hover and PM's selection drives
 * the "active block" concept; the overlays read both directly.
 *
 * Sections:
 *   • Sheet types + navigation helpers (top)
 *   • State interface and default values
 *   • Store creation + small helpers (navigateTo)
 */

import { create } from "zustand";

import type { Theme } from "./theme/css";

/**
 * Sheets mirror pagy's left-rail routes. `menu` is the default
 * (site picker + nav). Pages / Design / etc. render a `-medium`
 * sub-panel; `code` is `-large`. We don't have all the panels yet —
 * the store carries the value so the chrome can already animate
 * widths and slide directions correctly as they come online.
 */
export type Sheet =
  | "menu"
  | "pages"
  | "design"
  | "colors"
  | "fonts"
  | "buttons"
  | "inputs"
  | "cards"
  | "code"
  | "forms"
  | "form"
  | "settings";

export interface PageBuilderState {
  /** Toggled by the sliders icon in the canvas action row. */
  blockPanelOpen: boolean;
  setBlockPanelOpen: (v: boolean) => void;

  /** Desktop vs mobile canvas. */
  mobile: boolean;
  setMobile: (v: boolean) => void;

  /** Sidebar visibility. */
  panel: boolean;
  setPanel: (v: boolean) => void;

  /** Which sub-panel sheet is showing. */
  sheet: Sheet;
  setSheet: (v: Sheet) => void;

  /** The previous sheet, so PanelAnimator can pick the slide direction. */
  root: Sheet;
  setRoot: (v: Sheet) => void;

  /**
   * Mirror of shuffle's drag-in-progress state. We use this in place
   * of CSS `:not(:has([data-shuffle-active]))` so that components
   * can just *not render* their affordances during a drag (same
   * pattern as pagy's `draggedBlock` flag driving the `-active`
   * class on toolbars).
   */
  isDragging: boolean;
  setIsDragging: (v: boolean) => void;

  /**
   * The currently-applied site theme — colors + fonts + button/input
   * tokens. Mirrors `site.theme` in pagy, where it's stored on the
   * server. We hold it in the client store since pitter-patter has
   * no API yet; the design panel mutates this directly and the
   * canvas re-renders via the injected style tag.
   */
  theme: Theme;
  setTheme: (v: Theme | ((prev: Theme) => Theme)) => void;
}

/**
 * Default theme matches the YAG 1 site on pagy: Karla / Karla 500 with
 * the green-on-cream palette (#62bfad primary). We use this as the
 * seed so first-run looks like the screenshot the user is comparing
 * against. Once we wire a `theme` field into the demoDoc / fixtures
 * we can read it from there instead.
 */
const DEFAULT_THEME: Theme = {
  colors: {
    background: "#ffffff",
    neutral: "#34384f",
    primary: "#62bfad",
    secondary: "#d0ece6",
    tertiary: "#f9f7e8",
  },
  fonts: {
    base: "Karla",
    heading: "Karla",
    headingWeight: "500",
  },
  buttons: { radius: "rounded", style: "filled" },
  inputs: { shape: "rounded", style: "filled" },
};

export const usePageBuilderStore = create<PageBuilderState>((set) => ({
  blockPanelOpen: false,
  setBlockPanelOpen: (v) => set({ blockPanelOpen: v }),

  mobile: false,
  setMobile: (v) => set({ mobile: v }),

  panel: true,
  setPanel: (v) => set({ panel: v }),

  sheet: "menu",
  setSheet: (v) => set({ sheet: v }),

  root: "menu",
  setRoot: (v) => set({ root: v }),

  isDragging: false,
  setIsDragging: (v) => set({ isDragging: v }),

  theme: DEFAULT_THEME,
  setTheme: (v) =>
    set((prev) => ({ theme: typeof v === "function" ? v(prev.theme) : v })),
}));

/**
 * Navigate to a sheet and remember where we came from so the
 * PanelAnimator can pick the right slide direction on the way out.
 * Mirrors pagy's `usePanelNav` helper.
 */
export function navigateTo(sheet: Sheet) {
  const { sheet: current, setRoot, setSheet } = usePageBuilderStore.getState();
  setRoot(current);
  setSheet(sheet);
}

