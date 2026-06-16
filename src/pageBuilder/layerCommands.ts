/**
 * Commands the Layers panel dispatches through the stashed `pagesView`.
 *
 * These operate on live doc positions (re-derived every transaction, so always
 * current), mirroring `pageCommands.ts`: one transaction that also activates
 * the right page + re-anchors the selection so nothing is stranded in a slide
 * that's about to unmount.
 *
 *   • selectLayer  — click a row: switch to its page (if dormant) + select it.
 *   • moveNode     — drag a row: re-parent / reorder, schema-validated.
 *   • renameLayer  — rename a row: set the node's `name` attr (page → title).
 *
 * The killer property: because everything is position math on the doc, moving a
 * block onto a *different* page works even though that page renders zero DOM.
 */

import { Selection, type EditorState } from "prosemirror-state";
import type { Node as PmNode } from "prosemirror-model";
import type { EditorView } from "prosemirror-view";

import {
  activePageKey,
  getActivePageId,
  pageList,
  setActivePage,
} from "./activePagePlugin";
import { setSelectedBlocks } from "./blockHighlightPlugin";
import { setActiveSection } from "./sectionHighlightPlugin";
import { renamePage } from "./pageCommands";
import type { LayerNode } from "./layerTree";

/** Full-width structural nodes — selected via the section ring, not the block
 *  ring (mirrors how clicking them in the canvas behaves). */
const STRUCTURAL = new Set(["section", "header", "footer"]);

/** The page id enclosing `pos` in `doc`, or null. */
function pageIdAt(doc: PmNode, pos: number): string | null {
  const $pos = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)));
  for (let d = $pos.depth; d >= 0; d--) {
    const node = $pos.node(d);
    if (node.type.name === "page") return (node.attrs["id"] as string) || null;
  }
  return null;
}

/**
 * Select a layer: switch to its page first when it lives on a dormant slide
 * (so its content mounts), then ring it and scroll it into view. Pages just
 * switch the active slide.
 */
export function selectLayer(view: EditorView, node: LayerNode): void {
  if (node.type === "page") {
    setActivePage(view, node.pageId);
    return;
  }
  const { state } = view;
  let tr = state.tr;
  if (node.pageId && node.pageId !== getActivePageId(state)) {
    tr = tr.setMeta(activePageKey, { activeId: node.pageId });
  }
  // Anchor a text selection near the node so the now-active page mounts and the
  // view scrolls to it; `Selection.near` lands somewhere valid even for atoms.
  tr = tr.setSelection(Selection.near(tr.doc.resolve(node.pos + 1), 1));
  if (STRUCTURAL.has(node.type)) {
    tr = setActiveSection(tr, node.pos);
    tr = setSelectedBlocks(tr, []);
  } else {
    tr = setActiveSection(tr, null);
    tr = setSelectedBlocks(tr, [node.pos]);
  }
  view.dispatch(tr.scrollIntoView());
  view.focus();
}

/**
 * Multi-select: ring several layers at once (the tree's Shift/⌘-click). Sets
 * the block selection to every node's position and activates the last-clicked
 * node's page so its ring is visible; rows on other pages still highlight in
 * the tree (matched by position). Falls back to `selectLayer` for one node.
 */
export function selectLayers(view: EditorView, nodes: LayerNode[]): void {
  if (nodes.length <= 1) {
    if (nodes[0]) selectLayer(view, nodes[0]);
    return;
  }
  const { state } = view;
  const last = nodes[nodes.length - 1]!;
  let tr = state.tr;
  if (last.pageId && last.pageId !== getActivePageId(state)) {
    tr = tr.setMeta(activePageKey, { activeId: last.pageId });
  }
  tr = tr.setSelection(Selection.near(tr.doc.resolve(last.pos + 1), 1));
  tr = setActiveSection(tr, null);
  tr = setSelectedBlocks(tr, nodes.map((n) => n.pos));
  view.dispatch(tr.scrollIntoView());
  view.focus();
}

/** Move a node into another page (the row context menu's "Move to page"). A
 *  block lands appended in that page's last section (moveNode's page redirect);
 *  a section lands as the page's last section. */
export function moveNodeToPage(
  view: EditorView,
  fromPos: number,
  pageId: string,
): boolean {
  const page = pageList(view.state.doc).find((p) => p.id === pageId);
  if (!page) return false;
  return moveNode(view, fromPos, page.pos, 0);
}

/**
 * Move the node at `fromPos` into the container at `toParentPos`, before its
 * child `insertIndex`. Returns false (a no-op snap-back) when the move is
 * illegal or pointless. Handles reorder, re-parent, and cross-page moves.
 *
 * Validity is the schema's call: `canReplaceWith` rejects a section dropped
 * into a card, a block before a header, and so on. We also refuse to empty a
 * required `block+` container by moving its only child away.
 */
/**
 * Resolve a drop to a concrete `{ parentPos, index }`, or null when it's
 * illegal. Pure (reads state, mutates nothing) and shared by `moveNode` (to
 * commit) and the Layers panel (to show valid/invalid feedback mid-drag).
 *
 * Applies the block-onto-page redirect, refuses to empty a required `block+`
 * container, and defers the final say to the schema via `canReplaceWith`.
 */
export function resolveDrop(
  state: EditorState,
  fromPos: number,
  toParentPos: number,
  insertIndex: number,
): { parentPos: number; index: number } | null {
  const fromNode = state.doc.nodeAt(fromPos);
  let parent = state.doc.nodeAt(toParentPos);
  let parentPos = toParentPos;
  if (!fromNode || !parent) return null;

  // A page can't hold blocks directly (its content is header? section+
  // footer?), so dropping a block onto a page row means "append to that page" —
  // redirect into its last section.
  const fromName = fromNode.type.name;
  const isStructuralMove =
    fromName === "section" || fromName === "header" || fromName === "footer";
  if (parent.type.name === "page" && !isStructuralMove) {
    let sectionPos = -1;
    let sectionNode: PmNode | null = null;
    let off = 0;
    const start = toParentPos + 1;
    parent.forEach((child) => {
      if (child.type.name === "section") {
        sectionPos = start + off;
        sectionNode = child;
      }
      off += child.nodeSize;
    });
    if (sectionPos === -1 || !sectionNode) return null;
    parent = sectionNode;
    parentPos = sectionPos;
    insertIndex = (sectionNode as PmNode).childCount; // append
  }

  const $from = state.doc.resolve(fromPos);
  const sourceParentPos = $from.before($from.depth);
  const idx = Math.max(0, Math.min(insertIndex, parent.childCount));

  // Don't empty a required `block+` container by moving its only child out.
  if (sourceParentPos !== parentPos && $from.parent.childCount <= 1) return null;
  // Schema gate — the authority on every drop.
  if (!parent.canReplaceWith(idx, idx, fromNode.type)) return null;

  return { parentPos, index: idx };
}

/** True when `resolveDrop` would accept this move — the Layers panel's mid-drag
 *  validity check (drives the valid/invalid drop indicator). */
export function canDropNode(
  state: EditorState,
  fromPos: number,
  toParentPos: number,
  insertIndex: number,
): boolean {
  return resolveDrop(state, fromPos, toParentPos, insertIndex) !== null;
}

export function moveNode(
  view: EditorView,
  fromPos: number,
  toParentPos: number,
  insertIndex: number,
): boolean {
  const { state } = view;
  const resolved = resolveDrop(state, fromPos, toParentPos, insertIndex);
  if (!resolved) return false;
  const { parentPos, index } = resolved;
  const fromNode = state.doc.nodeAt(fromPos);
  if (!fromNode) return false;

  // No movement: same parent, same slot (the gap just before/after itself).
  const $from = state.doc.resolve(fromPos);
  const sourceParentPos = $from.before($from.depth);
  const fromIndex = $from.index($from.depth);
  if (sourceParentPos === parentPos && (index === fromIndex || index === fromIndex + 1)) {
    return false;
  }

  // Absolute insertion position: inside the parent, before child[index].
  const parent = state.doc.nodeAt(parentPos)!;
  let insertPos = parentPos + 1;
  for (let i = 0; i < index; i++) insertPos += parent.child(i).nodeSize;

  // Delete the source, then insert at the target mapped past the deletion.
  let tr = state.tr.delete(fromPos, fromPos + fromNode.nodeSize);
  const dest = tr.mapping.map(insertPos, -1);
  tr = tr.insert(dest, fromNode);

  // Activate the destination page + select the moved node so it's not stranded.
  const targetPageId = pageIdAt(tr.doc, dest);
  if (targetPageId) tr = tr.setMeta(activePageKey, { activeId: targetPageId });
  tr = tr.setSelection(Selection.near(tr.doc.resolve(dest + 1), 1));
  if (STRUCTURAL.has(fromNode.type.name)) {
    tr = setActiveSection(tr, dest);
    tr = setSelectedBlocks(tr, []);
  } else {
    tr = setActiveSection(tr, null);
    tr = setSelectedBlocks(tr, [dest]);
  }
  view.dispatch(tr.scrollIntoView());
  view.focus();
  return true;
}

/**
 * Rename a layer. Pages route to `renamePage` (their title); every other node
 * carries a `name` attr — an empty value clears it back to the derived label.
 */
export function renameLayer(view: EditorView, node: LayerNode, name: string): void {
  if (node.type === "page") {
    renamePage(view, node.pageId, name);
    return;
  }
  const { state } = view;
  const target = state.doc.nodeAt(node.pos);
  if (!target) return;
  const next = name.trim();
  if (((target.attrs["name"] as string) || "") === next) return;
  view.dispatch(
    state.tr.setNodeMarkup(node.pos, undefined, { ...target.attrs, name: next }),
  );
}
