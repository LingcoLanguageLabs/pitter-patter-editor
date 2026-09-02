/**
 * The single bridge between the ProseMirror editor and the zustand UI store.
 *
 * Replaces the per-concern `*Sync` React null-components (PagesSync,
 * ShuffleDragSync, the inline ResizeEnableSync). A plugin's `view()` is the
 * idiomatic ProseMirror place to mirror editor state *outward*, and a store
 * subscription is the idiomatic way to push external state *in* — so both
 * directions live here, in one place. New synced values are a line in
 * `pushOut()` or a branch in the subscriber, not a new component.
 *
 *   • outbound (editor → store): on every view update, mirror the page list,
 *     active page id, and shuffle's drag flag into the store — each diffed so
 *     a write only happens on real change (a fresh array every keystroke would
 *     thrash the panel's selectors). Also stashes the live `view` so the Pages
 *     panel (which lives outside the editor context) can dispatch through it.
 *   • inbound (store → editor): watch the `mobile` preview flag and flip
 *     shuffle into single-column mode (`setMultiColumn`), so a phone-width
 *     preview reorders vertically only — no resize, no horizontal drag, no
 *     grid tracks.
 *
 * Editor-only: NOT part of the reusable shuffle plugin, and not added to the
 * off-screen snapshot editors — so exactly one editor owns the store mirror.
 */

import { shufflePluginKey } from "@pitter-patter/shuffle";
import { redoDepth, undoDepth } from "prosemirror-history";
import { Plugin } from "prosemirror-state";
import type { Node as PmNode } from "prosemirror-model";

import { getActivePageId, pageList } from "./activePagePlugin";
import { getSelectedBlockPositions } from "./blockHighlightPlugin";
import { buildLayerTree } from "./layerTree";
import { getActiveSectionPos } from "./sectionHighlightPlugin";
import { usePageBuilderStore } from "./store";
import type { TransitionSpeed, TransitionType } from "./transitions";
import { unsplashPluginKey } from "./unsplashPicker";

export function editorStoreSyncPlugin() {
  return new Plugin({
    view(view) {
      const store = usePageBuilderStore;
      let lastDeckSignature = "";
      let lastDragging: boolean | null = null;
      let lastDoc: PmNode | null = null;
      let lastSelSignature = "";
      let lastCanUndo: boolean | null = null;
      let lastCanRedo: boolean | null = null;
      let lastUnsplash = "";
      // Debounced capture of the live doc into the store's per-site `docCache`
      // (which `sitePersistence` mirrors to localStorage), so edits survive a
      // reload. Cleared on destroy so a pending capture can't fire for a site
      // we've already switched away from (the next editor owns the new site).
      let docCaptureTimer: ReturnType<typeof setTimeout> | null = null;

      /** editor → store, diffed so we only write when something changed. */
      const pushOut = () => {
        const { state } = view;
        const s = store.getState();

        // Layer tree: rebuilt only when the doc actually changed (PM docs are
        // immutable, so a reference check is exact). Positions shift on any
        // edit, so a changed doc always means a fresh tree.
        if (state.doc !== lastDoc) {
          const isInitial = lastDoc === null;
          lastDoc = state.doc;
          s.setLayerTree(buildLayerTree(state.doc));
          // Persist edits, debounced. Skip the initial load — that doc is
          // already what seeded the editor, so there's nothing new to cache.
          if (!isInitial) {
            if (docCaptureTimer) clearTimeout(docCaptureTimer);
            docCaptureTimer = setTimeout(() => {
              docCaptureTimer = null;
              store.getState().cacheActiveDoc(view.state.doc.toJSON());
            }, 600);
          }
        }

        // Selection mirror so the tree can highlight the active row(s): the
        // selected block positions plus the active section (if any).
        const sectionPos = getActiveSectionPos(state);
        const selected = getSelectedBlockPositions(state);
        const selPositions =
          sectionPos != null ? [...selected, sectionPos] : selected;
        const selSignature = selPositions.join(",");
        if (selSignature !== lastSelSignature) {
          lastSelSignature = selSignature;
          s.setSelectedLayerPositions(selPositions);
        }

        const pages = pageList(state.doc).map(({ id, title, node }) => ({
          id,
          title,
          transition: (node.attrs["transition"] as TransitionType) || "none",
          transitionVariant: (node.attrs["transitionVariant"] as string) || "",
          transitionSpeed:
            (node.attrs["transitionSpeed"] as TransitionSpeed) || "medium",
        }));
        const activeId = getActivePageId(state);
        const deckSignature = JSON.stringify({ pages, activeId });
        if (deckSignature !== lastDeckSignature) {
          lastDeckSignature = deckSignature;
          s.setPages(pages);
          s.setActivePageId(activeId);
        }

        const dragging = !!shufflePluginKey.getState(state)?.activeNodePos;
        if (dragging !== lastDragging) {
          lastDragging = dragging;
          s.setIsDragging(dragging);
        }

        // History availability for the TopBar's undo/redo buttons (which sit
        // outside the editor and dispatch back through `pagesView`).
        const canUndo = undoDepth(state) > 0;
        const canRedo = redoDepth(state) > 0;
        if (canUndo !== lastCanUndo || canRedo !== lastCanRedo) {
          lastCanUndo = canUndo;
          lastCanRedo = canRedo;
          s.setHistoryState({ canUndo, canRedo });
        }

        // Unsplash picker (open + target) for the left-panel "Photos" sheet,
        // which lives outside the editor and dispatches picks back through
        // `pagesView`. Diffed via a JSON signature so a pos-remap on every
        // keystroke doesn't thrash the panel.
        const unsplash = unsplashPluginKey.getState(state) ?? {
          open: false,
          target: null,
        };
        const unsplashSig = JSON.stringify(unsplash);
        if (unsplashSig !== lastUnsplash) {
          lastUnsplash = unsplashSig;
          s.setUnsplash(unsplash);
        }
      };

      /** store → editor: mobile preview ⇒ shuffle single-column stack mode. */
      const applyMobile = (mobile: boolean) => {
        const multiColumn = !mobile;
        view.dispatch(
          view.state.tr.setMeta(shufflePluginKey, {
            type: "setMultiColumn",
            value: multiColumn,
          }),
        );
      };

      store.getState().setPagesView(view);
      pushOut();
      // Defer the initial inbound sync out of the view constructor (dispatching
      // mid-construction re-enters updateState). The guard makes it a no-op in
      // the common case (load is always desktop) — this just covers a remount
      // while the toggle is already on.
      queueMicrotask(() => applyMobile(store.getState().mobile));

      const unsubscribe = store.subscribe((next, prev) => {
        if (next.mobile !== prev.mobile) applyMobile(next.mobile);
      });

      return {
        update: pushOut,
        destroy() {
          unsubscribe();
          if (docCaptureTimer) clearTimeout(docCaptureTimer);
          store.getState().setPagesView(null);
        },
      };
    },
  });
}
