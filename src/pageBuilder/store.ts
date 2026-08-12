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
import {
  clearPersistedSites,
  loadPersistedSites,
  persistSites,
} from "./sitePersistence";
import { SAMPLE_SITES, createBlankSite, type SampleSite } from "./sites";
import type { GradeScope } from "./items/shared/grading";
import type { Theme } from "./theme/css";
import type { TransitionSpeed, TransitionType } from "./transitions";
import type { UnsplashPickerState } from "./unsplashPicker";

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
  | "photos"
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

  /**
   * Unsplash photo-picker state, mirrored from `unsplashPickerPlugin` by
   * `editorStoreSyncPlugin`. The picker UI is the left-panel "Photos" sheet
   * (outside the editor context): it watches `open` to auto-reveal itself,
   * reads `target` to know whether a pick should land somewhere specific
   * (targeted mode) vs. just browse, and dispatches the pick back through
   * `pagesView`.
   */
  unsplash: UnsplashPickerState;
  setUnsplash: (v: UnsplashPickerState) => void;

  /**
   * Undo/redo availability, mirrored from the editor's history plugin by
   * `editorStoreSyncPlugin` (it reads `undoDepth`/`redoDepth` on every view
   * update). The TopBar lives outside the ProseMirror context, so it reads
   * these to enable/disable its buttons and dispatches the commands through
   * `pagesView`. The ⌘Z / ⌘⇧Z shortcuts are handled by the editor keymap.
   */
  canUndo: boolean;
  canRedo: boolean;
  setHistoryState: (v: { canUndo: boolean; canRedo: boolean }) => void;

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
   * The catalog of sample sites (the page builder's in-memory "global store"
   * of starter sites — see {@link SampleSite}). Seeded from `SAMPLE_SITES`;
   * "+ New site" appends to it. The site picker lists these and switches the
   * `activeSiteId`.
   */
  sites: SampleSite[];
  /** Id of the site currently loaded in the editor. */
  activeSiteId: string;
  /**
   * Per-site edited-document snapshots (site id → ProseMirror doc JSON). Kept
   * current for the active site by a debounced capture in `editorStoreSync`
   * (`cacheActiveDoc`) and snapshotted on switch-away. The `<Shell>` seeds the
   * editor from this if present, else the site's starter `buildDoc`. Persisted
   * to localStorage (see `sitePersistence`) so edits survive a reload.
   */
  docCache: Record<string, unknown>;
  /** Per-site theme overrides (site id → edited theme), so design-panel tweaks
   *  persist per site across switches and reloads. Written by `setTheme`. */
  themeCache: Record<string, Theme>;
  /**
   * Bumped on `resetSites` and mixed into the `<Shell>` editor key, so a reset
   * forces a fresh editor mount even when `activeSiteId` is unchanged (e.g.
   * resetting while already on the first site).
   */
  siteEpoch: number;
  /**
   * Switch to a site by id: snapshots the current doc into `docCache`, points
   * `activeSiteId` at the target, and applies its (possibly overridden) theme.
   * The `<Shell>` keys the editor on `activeSiteId`, so this also re-mounts it
   * with the new document. Cross-site state keyed by doc position / page id
   * (thumbnails, layer selection) is cleared so nothing bleeds across the
   * switch — the fresh editor re-syncs it. No-op for an unknown / current id.
   */
  setActiveSite: (id: string) => void;
  /** Mint a fresh blank site, append it to the catalog, and switch to it. */
  addNewSite: () => void;
  /** Rename the active site (Settings → Site name). Edits the catalog entry in
   *  place, so the site picker + persisted catalog pick it up immediately. */
  setSiteName: (name: string) => void;
  /**
   * Delete the active site (Settings → Danger zone): drops it from the catalog,
   * discards its cached doc + theme override, and switches to the first
   * remaining site (re-themed, with doc-keyed state cleared like
   * `setActiveSite`). Bumps `siteEpoch` so the `<Shell>` remounts the editor on
   * the survivor. No-op when it's the only site — the catalog never empties.
   */
  deleteSite: () => void;
  /** Debounced capture of the active site's live document into `docCache`
   *  (called from `editorStoreSync` on doc changes). */
  cacheActiveDoc: (doc: unknown) => void;
  /** DEBUG: wipe persisted local state and restore the clean seed catalog
   *  (clears edits, theme overrides, and "+ New site" entries). */
  resetSites: () => void;

  /**
   * The currently-applied site theme — colors + fonts + button/input
   * tokens. Mirrors `site.theme` in pagy, where it's stored on the
   * server. We hold it in the client store since pitter-patter has
   * no API yet; the design panel mutates this directly and the
   * canvas re-renders via the injected style tag. Seeded from (and reset by)
   * the active site's theme.
   */
  theme: Theme;
  setTheme: (v: Theme | ((prev: Theme) => Theme)) => void;

  /**
   * Site-wide grading scope (Settings → Grading) — the granularity at which a
   * Check button grades learning prompts: per prompt / section / page /
   * activity. It gates which "Check" target a button's Action form offers; the
   * button records its own scope+target, so this is an authoring policy, not a
   * runtime input. Editor-state only for now (not yet per-site persisted).
   */
  gradingScope: GradeScope;
  setGradingScope: (v: GradeScope) => void;

  /** Light/dark mode for the editor chrome (see {@link ChromeTheme}). */
  chromeTheme: ChromeTheme;
  setChromeTheme: (v: ChromeTheme) => void;
  toggleChromeTheme: () => void;
}

/**
 * Default theme = the first sample site's theme (YAG 1 on pagy: Karla 500,
 * green-on-cream, #62bfad primary). Site themes now live in the catalog
 * ({@link SAMPLE_SITES}); this re-export keeps the name other modules import
 * (e.g. the `SiteRenderer` story) pointing at the same seed.
 */
export const DEFAULT_THEME: Theme = SAMPLE_SITES[0]!.theme;

// Rehydrate the sample-site catalog from localStorage (a debug aid; falls back
// to the seed catalog when nothing's stored). Resolved once at module load so
// the store's initial values reflect a prior session's edits.
const persisted = loadPersistedSites();
const initialSites = persisted?.sites ?? SAMPLE_SITES;
const initialActiveSiteId = persisted?.activeSiteId ?? SAMPLE_SITES[0]!.id;
const initialDocCache = persisted?.docCache ?? {};
const initialThemeCache = persisted?.themeCache ?? {};
const initialTheme =
  initialThemeCache[initialActiveSiteId] ??
  initialSites.find((s) => s.id === initialActiveSiteId)?.theme ??
  SAMPLE_SITES[0]!.theme;

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

  unsplash: { open: false, target: null },
  setUnsplash: (v) => set({ unsplash: v }),

  canUndo: false,
  canRedo: false,
  setHistoryState: (v) => set(v),

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

  sites: initialSites,
  activeSiteId: initialActiveSiteId,
  docCache: initialDocCache,
  themeCache: initialThemeCache,
  siteEpoch: 0,
  setActiveSite: (id) =>
    set((prev) => {
      if (id === prev.activeSiteId) return prev;
      const site = prev.sites.find((s) => s.id === id);
      if (!site) return prev;
      return {
        ...captureCurrentDoc(prev),
        activeSiteId: id,
        // Restore this site's theme override if it has one, else its default.
        theme: prev.themeCache[id] ?? site.theme,
        // Doc-keyed state from the outgoing site — clear it so the incoming
        // editor re-syncs cleanly (page ids can collide across sites).
        pageThumbs: {},
        activePageId: null,
        selectedLayerPositions: [],
      };
    }),
  addNewSite: () =>
    set((prev) => {
      const seq = prev.sites.filter((s) => s.id.startsWith("site-")).length + 1;
      const site = createBlankSite(seq);
      return {
        ...captureCurrentDoc(prev),
        sites: [...prev.sites, site],
        activeSiteId: site.id,
        theme: site.theme,
        pageThumbs: {},
        activePageId: null,
        selectedLayerPositions: [],
      };
    }),
  setSiteName: (name) =>
    set((prev) => ({
      sites: prev.sites.map((s) =>
        s.id === prev.activeSiteId ? { ...s, name } : s,
      ),
    })),
  deleteSite: () =>
    set((prev) => {
      // Never delete the only site — the catalog must always have one.
      if (prev.sites.length <= 1) return prev;
      const remaining = prev.sites.filter((s) => s.id !== prev.activeSiteId);
      const next = remaining[0]!;
      // Drop the deleted site's cached doc + theme override so they don't
      // linger in localStorage (and can't bleed onto a future site reusing
      // the id).
      const docCache = { ...prev.docCache };
      delete docCache[prev.activeSiteId];
      const themeCache = { ...prev.themeCache };
      delete themeCache[prev.activeSiteId];
      return {
        sites: remaining,
        activeSiteId: next.id,
        docCache,
        themeCache,
        theme: themeCache[next.id] ?? next.theme,
        // Doc-keyed state from the deleted site — clear it so the survivor's
        // editor re-syncs cleanly (same reset `setActiveSite` does on switch).
        pageThumbs: {},
        activePageId: null,
        selectedLayerPositions: [],
        // Force a fresh editor mount on the survivor.
        siteEpoch: prev.siteEpoch + 1,
      };
    }),
  cacheActiveDoc: (doc) =>
    set((prev) => ({
      docCache: { ...prev.docCache, [prev.activeSiteId]: doc },
    })),
  resetSites: () => {
    clearPersistedSites();
    set((prev) => ({
      sites: SAMPLE_SITES,
      activeSiteId: SAMPLE_SITES[0]!.id,
      docCache: {},
      themeCache: {},
      theme: SAMPLE_SITES[0]!.theme,
      pageThumbs: {},
      activePageId: null,
      selectedLayerPositions: [],
      // Force a fresh editor mount even if we were already on the first site.
      siteEpoch: prev.siteEpoch + 1,
    }));
  },

  theme: initialTheme,
  setTheme: (v) =>
    set((prev) => {
      const theme = typeof v === "function" ? v(prev.theme) : v;
      // Mirror into the per-site cache so the override persists across switches
      // and reloads.
      return {
        theme,
        themeCache: { ...prev.themeCache, [prev.activeSiteId]: theme },
      };
    }),

  gradingScope: "prompt",
  setGradingScope: (v) => set({ gradingScope: v }),

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

// Persist the catalog slice (active site + per-site doc/theme caches + custom
// sites) to localStorage on any change. `persistSites` debounces, so the very
// frequent editor-driven updates collapse into at most one write per idle
// window. A debug aid — see `sitePersistence`.
usePageBuilderStore.subscribe((state) =>
  persistSites({
    sites: state.sites,
    activeSiteId: state.activeSiteId,
    docCache: state.docCache,
    themeCache: state.themeCache,
  }),
);

/**
 * Snapshot the live editor's current document into `docCache` under the
 * outgoing site's id, so switching back restores the in-session edits. Reads
 * the doc off the stashed `pagesView` (the same bridge the panels dispatch
 * through); a no-op `{}` when no view is mounted yet.
 */
function captureCurrentDoc(
  prev: PageBuilderState,
): Pick<PageBuilderState, "docCache"> | Record<string, never> {
  const doc = prev.pagesView?.state.doc;
  if (!doc) return {};
  return { docCache: { ...prev.docCache, [prev.activeSiteId]: doc.toJSON() } };
}

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

