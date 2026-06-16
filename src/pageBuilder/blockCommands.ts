/**
 * Block-level structural commands — duplicate / delete / group (wrap) / ungroup
 * — plus the small geometry helpers they need.
 *
 * Pure functions over an `EditorView`: each builds one transaction and
 * re-asserts the block selection (quiet, so a menu flow never spawns the
 * settings popover). Lifted verbatim from `BlockContextMenu`, which still has
 * equivalent inline copies — the Layers panel's row context menu uses THIS
 * module. TODO: fold `BlockContextMenu`'s callbacks onto these so the canvas
 * and layers menus share one implementation (deferred to avoid editing that
 * file while it's in flux on the shared tree).
 */

import type { EditorState } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";

import { setSelectedBlocks } from "./blockHighlightPlugin";

/** container / card / row — the wrappers that hold `block+`, so unwrapping is
 *  one `replaceWith` for all three. Also gates re-grouping: blocks already
 *  inside one of these don't get a Group option (nesting another is waste). */
export const GROUP_TYPES = new Set(["container", "card", "row"]);

/** Drop positions nested inside other selected nodes — acting on a parent
 *  already covers its children, and deleting a child before its selected parent
 *  would corrupt the parent's range. */
export function pruneNested(state: EditorState, positions: number[]): number[] {
  return positions.filter(
    (pos) =>
      !positions.some((other) => {
        if (other === pos || other > pos) return false;
        const node = state.doc.nodeAt(other);
        return node != null && pos < other + node.nodeSize;
      }),
  );
}

/** The parent shared by every position, or null when they live under different
 *  parents — the precondition for grouping (a container has one home). */
export function sharedParent(
  state: EditorState,
  positions: number[],
): { typeName: string } | null {
  if (positions.length === 0) return null;
  let key: string | null = null;
  let typeName: string | null = null;
  for (const pos of positions) {
    const $pos = state.doc.resolve(pos);
    const posKey = `${$pos.depth}:${$pos.depth === 0 ? 0 : $pos.start($pos.depth)}`;
    if (key == null) {
      key = posKey;
      typeName = $pos.parent.type.name;
    } else if (posKey !== key) {
      return null;
    }
  }
  return typeName ? { typeName } : null;
}

/** Position of the clicked block when it's a container/card, else the nearest
 *  enclosing one, else null — so Ungroup can reach a wrapper through its
 *  children (a container's children fill its box). */
export function nearestGroupPos(state: EditorState, pos: number): number | null {
  const node = state.doc.nodeAt(pos);
  if (node && GROUP_TYPES.has(node.type.name)) return pos;
  const $pos = state.doc.resolve(pos);
  for (let depth = $pos.depth; depth >= 1; depth--) {
    if (GROUP_TYPES.has($pos.node(depth).type.name)) return $pos.before(depth);
  }
  return null;
}

/** Insert a copy of the block at `pos` directly after it. */
export function duplicateBlock(view: EditorView, pos: number): void {
  const node = view.state.doc.nodeAt(pos);
  if (!node) return;
  view.dispatch(view.state.tr.insert(pos + node.nodeSize, node));
}

/** Delete the block(s) at `positions` (nested ones pruned), clearing the
 *  selection. Deletes bottom-up so positions stay valid through the loop. */
export function deleteBlocks(view: EditorView, positions: number[]): void {
  const pruned = pruneNested(view.state, positions).sort((a, b) => b - a);
  const tr = view.state.tr;
  for (const pos of pruned) {
    const node = view.state.doc.nodeAt(pos);
    if (node) tr.delete(pos, pos + node.nodeSize);
  }
  view.dispatch(setSelectedBlocks(tr, []));
}

/**
 * Wrap the block(s) — in document order, at the first block's slot — in a
 * container, card, or row.
 *
 *  • container / card: a vertical stack. The wrapper spans the union of the
 *    blocks' explicit shuffle columns when they all have them.
 *  • row: lays the blocks side by side, split evenly across the 12 content
 *    columns with no gaps (2 → 6/6, 3 → 4/4/4, …).
 */
export function groupBlocks(
  view: EditorView,
  positions: number[],
  kind: "container" | "card" | "row",
): void {
  const { state } = view;
  const wrapperType = state.schema.nodes[kind];
  if (!wrapperType) return;
  const sorted = pruneNested(state, positions).sort((a, b) => a - b);
  const parent = sharedParent(state, sorted);
  if (sorted.length === 0 || !parent) return;
  const nodes = sorted
    .map((pos) => state.doc.nodeAt(pos))
    .filter((node): node is NonNullable<typeof node> => node != null);

  let children = nodes;
  let wrapperAttrs: Record<string, number> | null = null;

  if (kind === "row") {
    const n = nodes.length;
    children = nodes.map((node, i) =>
      node.type.create(
        {
          ...node.attrs,
          shuffleStart: 1 + Math.round((i * 12) / n),
          shuffleEnd: Math.round(((i + 1) * 12) / n),
        },
        node.content,
        node.marks,
      ),
    );
  } else {
    const starts = nodes
      .map((node) => node.attrs["shuffleStart"])
      .filter((v): v is number => typeof v === "number");
    const ends = nodes
      .map((node) => node.attrs["shuffleEnd"])
      .filter((v): v is number => typeof v === "number");
    wrapperAttrs =
      starts.length === nodes.length && ends.length === nodes.length
        ? { shuffleStart: Math.min(...starts), shuffleEnd: Math.max(...ends) }
        : null;
  }

  const tr = state.tr;
  // Delete top-down so lower positions stay valid; the first block's position
  // then doubles as the insertion slot.
  for (let i = sorted.length - 1; i >= 0; i--) {
    const pos = sorted[i]!;
    const node = state.doc.nodeAt(pos)!;
    tr.delete(pos, pos + node.nodeSize);
  }
  const insertAt = sorted[0]!;
  tr.insert(insertAt, wrapperType.create(wrapperAttrs, children));
  view.dispatch(setSelectedBlocks(tr, [insertAt], true));
}

/** Replace a container/card/row with its children, selecting them. */
export function ungroupBlock(view: EditorView, pos: number): void {
  const node = view.state.doc.nodeAt(pos);
  if (!node || !GROUP_TYPES.has(node.type.name)) return;
  const childPositions: number[] = [];
  let childPos = pos;
  node.content.forEach((child) => {
    childPositions.push(childPos);
    childPos += child.nodeSize;
  });
  const tr = view.state.tr.replaceWith(pos, pos + node.nodeSize, node.content);
  view.dispatch(setSelectedBlocks(tr, childPositions, true));
}
