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
import { Plugin } from "prosemirror-state";

import { getActivePageId, pageList } from "./activePagePlugin";
import { usePageBuilderStore } from "./store";
import type { TransitionSpeed, TransitionType } from "./transitions";

export function editorStoreSyncPlugin() {
  return new Plugin({
    view(view) {
      const store = usePageBuilderStore;
      let lastDeckSignature = "";
      let lastDragging: boolean | null = null;

      /** editor → store, diffed so we only write when something changed. */
      const pushOut = () => {
        const { state } = view;
        const s = store.getState();

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
      };

      /** store → editor: mobile preview ⇒ shuffle single-column stack mode. */
      const applyMobile = (mobile: boolean) => {
        const multiColumn = !mobile;
        if (shufflePluginKey.getState(view.state)?.multiColumn === multiColumn) {
          return;
        }
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
          store.getState().setPagesView(null);
        },
      };
    },
  });
}
