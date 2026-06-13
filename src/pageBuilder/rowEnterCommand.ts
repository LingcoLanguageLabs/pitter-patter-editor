/**
 * Enter inside a row cell → convert that cell into a container.
 *
 * A row lays its direct children out side by side (one grid column each),
 * so the default Enter — which splits the paragraph and inserts the new
 * one as a *sibling* — drops a third column into the row instead of
 * stacking the new line under the current one. That's the unproductive
 * "new paragraph in the middle" behaviour.
 *
 * Instead, when the cursor sits in a paragraph whose DIRECT parent is a
 * row, we wrap just that one cell in a container (inheriting the cell's
 * column span, so the row's layout doesn't shift) and split the paragraph
 * inside it. The new paragraph then stacks below the current one within
 * the same column; the other cells are untouched. Once the cell is a
 * container, its parent is no longer a row, so subsequent Enters fall
 * through to the default split and stack normally.
 *
 * Implemented with ProseMirror's own primitives — `findWrapping` + `wrap`
 * to wrap the cell, then `split` to do the split (which copies the
 * paragraph's attrs onto the new block and maps the cursor into it). It's
 * bound ahead of `baseKeymap` in `Editor.tsx` and returns false (so the
 * base Enter runs) for any selection that isn't a collapsed cursor in a
 * row-child paragraph.
 */

import type { Command } from "prosemirror-state";
import { TextSelection } from "prosemirror-state";
import { findWrapping } from "prosemirror-transform";

export const splitRowCellIntoContainer: Command = (state, dispatch) => {
  const { selection, schema } = state;
  // Only a collapsed cursor in a paragraph. (A range selection or a
  // non-paragraph block falls through to the default Enter.)
  if (!(selection instanceof TextSelection) || !selection.empty) return false;

  const { $from } = selection;
  if ($from.parent.type.name !== "paragraph") return false;

  const depth = $from.depth;
  if (depth < 1 || $from.node(depth - 1).type.name !== "row") return false;

  const containerType = schema.nodes["container"];
  if (!containerType) return false;

  // The paragraph's range within the row, and a container wrapping it that
  // takes the cell's column span (so the row layout is unchanged).
  const range = $from.blockRange();
  if (!range) return false;
  const wrapping = findWrapping(range, containerType, {
    shuffleStart: $from.parent.attrs["shuffleStart"],
    shuffleEnd: $from.parent.attrs["shuffleEnd"],
  });
  if (!wrapping) return false;

  if (!dispatch) return true;

  const tr = state.tr;
  tr.wrap(range, wrapping);
  // Split the now-wrapped paragraph at the cursor → a sibling paragraph
  // inside the container. `split` copies the block's attrs onto the new
  // one and maps the selection into it.
  tr.split(tr.mapping.map($from.pos));
  dispatch(tr.scrollIntoView());
  return true;
};
