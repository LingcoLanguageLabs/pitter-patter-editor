/**
 * Active-slide tracking.
 *
 * The doc is a deck of `page` nodes, but the canvas shows one slide at a
 * time. This plugin holds the active page's stable `id`; `PageNodeView`
 * reads it to decide whether to mount its content (so inactive slides
 * mount no descendants). The active page defaults to the first page and
 * falls back to it if the active one is deleted.
 *
 * Tracked by `id`, not position, so edits never need remapping.
 */

import {
  Plugin,
  PluginKey,
  Selection,
  type EditorState,
  type Transaction,
} from "prosemirror-state";
import type { Node as PmNode } from "prosemirror-model";
import type { EditorView } from "prosemirror-view";

interface ActivePageState {
  activeId: string | null;
}

export const activePageKey = new PluginKey<ActivePageState>("pb-active-page");

/** A page in the deck, with its doc position + node — the shared lens
 *  every page operation (sync, reorder, add, duplicate, delete) reads. */
export interface PageEntry {
  id: string;
  title: string;
  /** Position before the page node. */
  pos: number;
  node: PmNode;
}

/** All `page` nodes in document order. */
export function pageList(doc: PmNode): PageEntry[] {
  const out: PageEntry[] = [];
  doc.forEach((node, offset) => {
    if (node.type.name === "page") {
      out.push({
        id: (node.attrs["id"] as string) || "",
        title: (node.attrs["title"] as string) || "Untitled",
        pos: offset,
        node,
      });
    }
  });
  return out;
}

/** Id of the first `page` in the doc, or null if there are none. */
function firstPageId(doc: PmNode): string | null {
  let id: string | null = null;
  doc.forEach((node) => {
    if (id == null && node.type.name === "page") id = (node.attrs["id"] as string) || null;
  });
  return id;
}

/** Whether a page with `id` exists in the doc. */
function hasPage(doc: PmNode, id: string): boolean {
  let found = false;
  doc.forEach((node) => {
    if (node.type.name === "page" && (node.attrs["id"] as string) === id) found = true;
  });
  return found;
}

/** Doc position (before-node) of the page with `id`, or null. */
function pagePos(doc: PmNode, id: string): number | null {
  let pos: number | null = null;
  doc.forEach((node, offset) => {
    if (pos == null && node.type.name === "page" && (node.attrs["id"] as string) === id) {
      pos = offset;
    }
  });
  return pos;
}

/** The active page's id, or null. */
export function getActivePageId(state: EditorState): string | null {
  return activePageKey.getState(state)?.activeId ?? null;
}

/**
 * Switch the active slide. Also moves the selection into the newly-active
 * page — otherwise the cursor would be left inside a slide that's about to
 * unmount (its content NodeView stops rendering), which PM can't draw.
 */
export function setActivePage(view: EditorView, id: string): void {
  const { state } = view;
  let tr = state.tr.setMeta(activePageKey, { activeId: id } satisfies ActivePageState);
  const pos = pagePos(state.doc, id);
  if (pos != null) {
    tr = tr.setSelection(Selection.near(tr.doc.resolve(pos + 1), 1));
  }
  view.dispatch(tr.scrollIntoView());
}

export function activePagePlugin() {
  return new Plugin<ActivePageState>({
    key: activePageKey,
    state: {
      init: (_config, state) => ({ activeId: firstPageId(state.doc) }),
      apply(tr, value, _old, newState) {
        const meta = tr.getMeta(activePageKey) as ActivePageState | undefined;
        if (meta && "activeId" in meta) return meta;
        // Keep a valid active page: if the current one is gone (deleted) or
        // unset, fall back to the first page.
        if (value.activeId == null || !hasPage(newState.doc, value.activeId)) {
          return { activeId: firstPageId(newState.doc) };
        }
        return value;
      },
    },
  });
}
