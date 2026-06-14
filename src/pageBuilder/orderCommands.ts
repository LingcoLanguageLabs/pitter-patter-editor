/**
 * Z-order ("arrange") commands for overlapping blocks — Google Slides'
 * Bring to front / forward, Send backward / to back.
 *
 * Stacking in shuffle is an explicit per-block `zIndex` attribute rendered as
 * an inline `z-index` (the shuffle plugin re-derives it from the attr on every
 * transaction). Crucially, overlap only happens inside a `row`: shuffle pins
 * every row child to `grid-row-start: 1`, so children sharing columns stack in
 * one cell, while section/container children get distinct grid rows and never
 * overlap. So ordering is only meaningful for a block whose parent is a `row`
 * with ≥2 children — everywhere else there's nothing to order against, which
 * is exactly when Slides hides the menu.
 *
 * We model the row's children as an effective bottom→top order keyed on
 * `(zIndex, document index)` — matching how the browser paints equal z-indexes
 * by document order, and how shuffle's drag bumps the grabbed block to
 * `highest + 1`. Each command reshuffles that order and then renormalizes the
 * children to `zIndex = rank` (0…n-1): gap-free, deterministic, and still
 * compatible with shuffle's drag-to-top (a later drag elevates above the max).
 */

import { shufflePluginKey } from "@pitter-patter/shuffle";
import type { Node as PmNode } from "prosemirror-model";
import { NodeSelection } from "prosemirror-state";
import type { Command, EditorState, Transaction } from "prosemirror-state";

import { getSelectedBlockPositions } from "./blockHighlightPlugin";

export type OrderOp = "front" | "forward" | "backward" | "back";

interface OrderContext {
  /** Row children in document order, with absolute positions. */
  children: { pos: number; node: PmNode }[];
  /** Document index of the target block within the row. */
  targetIndex: number;
}

/** Whether each direction is possible for the menu's enabled state. */
export interface OrderAvailability {
  canRaise: boolean;
  canLower: boolean;
}

/**
 * Resolve the single block this command acts on. Prefer the editor's tracked
 * block selection (set on click / right-click by `blockHighlightPlugin`), so
 * it works for text blocks too; fall back to a raw `NodeSelection` (atoms).
 * `explicit` wins — the context menu passes the exact clicked position.
 */
function targetPos(state: EditorState, explicit?: number): number | null {
  if (explicit != null) return explicit;
  const selected = getSelectedBlockPositions(state);
  if (selected.length === 1) return selected[0]!;
  const sel = state.selection;
  if (sel instanceof NodeSelection) return sel.from;
  return null;
}

/** The orderable context for a target block, or null when ordering doesn't
 *  apply (not inside a row, or a row with a single child).
 *
 *  We resolve the nearest block that is a DIRECT child of a row, walking up
 *  from the clicked node — so right-clicking inside a card/container still
 *  orders that wrapper (the thing that actually overlaps in the row), not its
 *  inner content. Atoms (image/button/shape) are themselves the row child. */
function orderContext(state: EditorState, explicit?: number): OrderContext | null {
  const pos = targetPos(state, explicit);
  if (pos == null) return null;
  const $pos = state.doc.resolve(pos);

  let rowDepth = -1;
  let targetIndex = -1;
  if ($pos.parent.type.name === "row") {
    // The clicked block (nodeAfter) is itself a direct row child.
    rowDepth = $pos.depth;
    targetIndex = $pos.index();
  } else {
    // Walk up the ancestors for the first whose parent is a row.
    for (let d = $pos.depth; d >= 1; d--) {
      if ($pos.node(d - 1).type.name === "row") {
        rowDepth = d - 1;
        targetIndex = $pos.index(d - 1);
        break;
      }
    }
  }
  if (rowDepth < 0) return null;

  const row = $pos.node(rowDepth);
  if (row.childCount < 2) return null;
  const children: { pos: number; node: PmNode }[] = [];
  let p = $pos.start(rowDepth);
  row.forEach((child) => {
    children.push({ pos: p, node: child });
    p += child.nodeSize;
  });
  return { children, targetIndex };
}

/** Bottom→top order of the children as document indices, keyed on
 *  `(zIndex, document index)` — the browser's paint order for grid items. */
function effectiveOrder(children: OrderContext["children"]): number[] {
  return children
    .map((c, i) => ({ i, z: (c.node.attrs["zIndex"] as number) ?? 0 }))
    .sort((a, b) => a.z - b.z || a.i - b.i)
    .map((e) => e.i);
}

/** For the context menu: which directions are available, or null to hide the
 *  Order submenu entirely (the single-object case). */
export function orderAvailability(
  state: EditorState,
  explicit?: number,
): OrderAvailability | null {
  const ctx = orderContext(state, explicit);
  if (!ctx) return null;
  const order = effectiveOrder(ctx.children);
  const rank = order.indexOf(ctx.targetIndex);
  return { canRaise: rank < order.length - 1, canLower: rank > 0 };
}

/** Build the transaction that re-stacks the row, or null if it'd be a no-op
 *  (already at the requested extreme). */
function reorderTransaction(
  state: EditorState,
  op: OrderOp,
  explicit?: number,
): Transaction | null {
  const ctx = orderContext(state, explicit);
  if (!ctx) return null;
  const order = effectiveOrder(ctx.children);
  const n = order.length;
  const rank = order.indexOf(ctx.targetIndex);
  const canRaise = rank < n - 1;
  const canLower = rank > 0;
  if ((op === "front" || op === "forward") && !canRaise) return null;
  if ((op === "back" || op === "backward") && !canLower) return null;

  const next = order.slice();
  next.splice(rank, 1);
  if (op === "front") next.push(ctx.targetIndex);
  else if (op === "back") next.unshift(ctx.targetIndex);
  else if (op === "forward") next.splice(rank + 1, 0, ctx.targetIndex);
  else next.splice(rank - 1, 0, ctx.targetIndex);

  const tr = state.tr;
  // setNodeAttribute keeps node sizes, so every child position stays valid
  // across the loop.
  next.forEach((docIndex, newRank) => {
    tr.setNodeAttribute(ctx.children[docIndex]!.pos, "zIndex", newRank);
  });
  // Match shuffle's own zIndex command so the change rides the same drag
  // composition when one is in flight (a no-op otherwise).
  tr.setMeta("composition", shufflePluginKey.getState(state)?.comp);
  return tr;
}

/**
 * A ProseMirror command for one order operation. Returns false when ordering
 * doesn't apply (so keyboard shortcuts fall through to normal navigation) or
 * when the move is a no-op. `explicit` targets a specific block (context menu);
 * omit it to act on the current selection (keyboard).
 */
export function orderCommand(op: OrderOp, explicit?: number): Command {
  return (state, dispatch) => {
    const tr = reorderTransaction(state, op, explicit);
    if (!tr) return false;
    dispatch?.(tr.scrollIntoView());
    return true;
  };
}
