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
import type { EditorView } from "prosemirror-view";

import type { LayerNode } from "./layerTree";
import type { Theme } from "./theme/css";
import type { TransitionSpeed, TransitionType } from "./transitions";

/** A slide's id + title + entry transition, mirrored from the doc for the
 *  Pages panel (the transition gallery + filmstrip badge read these). */
export interface PageMeta {
  id: string;
  title: string;
  transition: TransitionType;
  transitionVariant: string;
  transitionSpeed: TransitionSpeed;
}

/** How the Pages filmstrip renders each slide: "thumbnails" shows the 16:9
 *  snapshot beside the name; "list" is a compact name-only outline (more
 *  slides per screen). A display preference, persisted in the store so it
 *  survives panel navigation. */
export type PagesViewMode = "thumbnails" | "list";

/**
 * Light/dark mode for the *editor chrome* (topbar, panels, popovers, canvas
 * matte) — NOT the site being built, which keeps its own `theme`. Toggled by
 * the sun/moon button in the TopBar; a `<html data-pb-theme>` attribute (set in
 * `Shell`) drives the `:root[data-pb-theme="dark"]` token overrides in CSS, so
 * even the `document.body`-portaled popovers pick it up.
 */
export type ChromeTheme = "light" | "dark";

const CHROME_THEME_KEY = "pb-chrome-theme";

/** Seed the chrome theme: a previously-saved choice wins, else follow the OS
 *  `prefers-color-scheme` on first load. SSR-safe (defaults to light). */
export function initialChromeTheme(): ChromeTheme {
  if (typeof window === "undefined") return "light";
  const saved = window.localStorage.getItem(CHROME_THEME_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

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
  | "layers"
  | "transitions"
  | "design"
  | "colors"
  | "fonts"
  | "buttons"
  | "inputs"
  | "cards"
  | "code"
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

  /**
   * Preview ("experience the site") toggle. When true, `<Shell>` overlays
   * the canvas with `<PagePreview>` — a read-only, chrome-free, interactive
   * render of the deck where links/buttons/videos work like a real visit.
   * Mirrors pagy's `s.preview` driving its `.frame_preview` overlay.
   */
  preview: boolean;
  setPreview: (v: boolean) => void;

  /** Which sub-panel sheet is showing. */
  sheet: Sheet;
  setSheet: (v: Sheet) => void;

  /** The previous sheet, so PanelAnimator can pick the slide direction. */
  root: Sheet;
  setRoot: (v: Sheet) => void;

  /**
   * Slide-deck mirror for the Pages panel. The panel lives outside the
   * ProseMirror context, so `editorStoreSyncPlugin` (inside the editor)
   * pushes the page list + active id here and stashes the live `view` for
   * dispatching (switch / reorder / add / duplicate / delete) — the same
   * bridge that mirrors `isDragging`.
   */
  pages: PageMeta[];
  setPages: (v: PageMeta[]) => void;
  activePageId: string | null;
  setActivePageId: (v: string | null) => void;
  pagesView: EditorView | null;
  setPagesView: (v: EditorView | null) => void;

  /** Thumbnails vs. compact list rendering for the Pages filmstrip. */
  pagesViewMode: PagesViewMode;
  setPagesViewMode: (v: PagesViewMode) => void;

  /**
   * Figma-style layers tree — a flat, depth-ordered serialization of the whole
   * deck (page → header/section/footer → blocks → nested containers → leaves),
   * mirrored from the doc by `editorStoreSyncPlugin` (rebuilt only on doc
   * change). The Layers panel renders it and dispatches select / move / rename
   * through `pagesView`, the same bridge the Pages panel rides.
   */
  layerTree: LayerNode[];
  setLayerTree: (v: LayerNode[]) => void;
  /** Layer keys whose children are collapsed in the tree (local UI state). */
  collapsedLayers: Record<string, true>;
  toggleLayerCollapsed: (key: string) => void;
  /** Force-expand the given keys (reveal-on-select uncollapses ancestors of a
   *  node selected on the canvas so its row is actually visible). */
  expandLayers: (keys: string[]) => void;
  /** Doc positions (before-node) of the currently selected block(s) + active
   *  section, mirrored from the editor so the tree can highlight the matching
   *  rows. */
  selectedLayerPositions: number[];
  setSelectedLayerPositions: (v: number[]) => void;

  /**
   * "Add a section" template picker (pagy's AddSectionModal). The
   * per-section "+ Add section" chrome stashes the doc position the new
   * section should land at and opens the modal; picking a template (or
   * "Add a blank section") inserts at that position via `pagesView` and
   * closes. `null` position means closed. Mirrors pagy's
   * `sectionInsertionPath` + `sectionModalOpen` store pair.
   */
  sectionModalOpen: boolean;
  sectionInsertPos: number | null;
  openSectionModal: (pos: number) => void;
  closeSectionModal: () => void;

  /** Cached page thumbnails (page id → data URL), generated by snapshotting
   *  the rendered page. Read by `<PageThumbnail>` in the rail / flowchart. */
  pageThumbs: Record<string, string>;
  setPageThumb: (id: string, url: string) => void;

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

  /** Light/dark mode for the editor chrome (see {@link ChromeTheme}). */
  chromeTheme: ChromeTheme;
  setChromeTheme: (v: ChromeTheme) => void;
  toggleChromeTheme: () => void;
}

/**
 * Default theme matches the YAG 1 site on pagy: Karla / Karla 500 with
 * the green-on-cream palette (#62bfad primary). We use this as the
 * seed so first-run looks like the screenshot the user is comparing
 * against. Once we wire a `theme` field into the demoDoc / fixtures
 * we can read it from there instead.
 */
export const DEFAULT_THEME: Theme = {
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
  // Pagy's token vocabulary: radius "" = pill (default), "none" | "small" |
  // "medium"; style "" = default, then thick | soft | shadow | sharp | brutal.
  buttons: { radius: "", style: "" },
  // shape: radius-none | radius-small | radius-medium | radius-large;
  // style: solid (default) | outline | soft | line.
  inputs: { shape: "radius-small", style: "solid" },
};

export const usePageBuilderStore = create<PageBuilderState>((set) => ({
  blockPanelOpen: false,
  setBlockPanelOpen: (v) => set({ blockPanelOpen: v }),

  mobile: false,
  setMobile: (v) => set({ mobile: v }),

  panel: true,
  setPanel: (v) => set({ panel: v }),

  preview: false,
  setPreview: (v) => set({ preview: v }),

  sheet: "menu",
  setSheet: (v) => set({ sheet: v }),

  root: "menu",
  setRoot: (v) => set({ root: v }),

  pages: [],
  setPages: (v) => set({ pages: v }),
  activePageId: null,
  setActivePageId: (v) => set({ activePageId: v }),
  pagesView: null,
  setPagesView: (v) => set({ pagesView: v }),

  pagesViewMode: "thumbnails",
  setPagesViewMode: (v) => set({ pagesViewMode: v }),

  layerTree: [],
  setLayerTree: (v) => set({ layerTree: v }),
  collapsedLayers: {},
  toggleLayerCollapsed: (key) =>
    set((prev) => {
      const next = { ...prev.collapsedLayers };
      if (next[key]) delete next[key];
      else next[key] = true;
      return { collapsedLayers: next };
    }),
  expandLayers: (keys) =>
    set((prev) => {
      let changed = false;
      const next = { ...prev.collapsedLayers };
      for (const key of keys) {
        if (next[key]) {
          delete next[key];
          changed = true;
        }
      }
      return changed ? { collapsedLayers: next } : prev;
    }),
  selectedLayerPositions: [],
  setSelectedLayerPositions: (v) => set({ selectedLayerPositions: v }),

  sectionModalOpen: false,
  sectionInsertPos: null,
  openSectionModal: (pos) => set({ sectionModalOpen: true, sectionInsertPos: pos }),
  closeSectionModal: () => set({ sectionModalOpen: false, sectionInsertPos: null }),

  pageThumbs: {},
  setPageThumb: (id, url) =>
    set((prev) => ({ pageThumbs: { ...prev.pageThumbs, [id]: url } })),

  isDragging: false,
  setIsDragging: (v) => set({ isDragging: v }),

  theme: DEFAULT_THEME,
  setTheme: (v) =>
    set((prev) => ({ theme: typeof v === "function" ? v(prev.theme) : v })),

  chromeTheme: initialChromeTheme(),
  setChromeTheme: (v) => {
    if (typeof window !== "undefined")
      window.localStorage.setItem(CHROME_THEME_KEY, v);
    set({ chromeTheme: v });
  },
  toggleChromeTheme: () =>
    set((prev) => {
      const next = prev.chromeTheme === "dark" ? "light" : "dark";
      if (typeof window !== "undefined")
        window.localStorage.setItem(CHROME_THEME_KEY, next);
      return { chromeTheme: next };
    }),
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

