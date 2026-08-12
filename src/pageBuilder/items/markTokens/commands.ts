/**
 * Mark the Words — the "Mark target" selection action. Available when a non-empty
 * text selection sits inside the question's `mt_text` region; running it TOGGLES
 * the `mttoken` mark over the selection (the answer key). The sibling of Fill
 * Blanks' "Mark as blank", but a toggle (mark on/off) rather than a node swap —
 * the words stay as plain, clickable text in the completer.
 */

import { toggleMark } from "prosemirror-commands";
import type { EditorState, Transaction } from "prosemirror-state";

import type { ItemSelectionAction } from "../types";
import { MTTOKEN_MARK, MT_TEXT_NODE } from "./schema";

/** Depth of the nearest `mt_text` ancestor of `$pos`, or -1. */
function mtTextDepth($pos: EditorState["selection"]["$from"]): number {
  for (let d = $pos.depth; d > 0; d--) {
    if ($pos.node(d).type.name === MT_TEXT_NODE) return d;
  }
  return -1;
}

/** True iff the whole selection is text inside ONE `mt_text` region. */
export function canMarkToken(state: EditorState): boolean {
  const { selection } = state;
  const { $from, $to, empty } = selection;
  if (empty) return false;
  if (!state.doc.textBetween(selection.from, selection.to).trim()) return false;
  const d = mtTextDepth($from);
  return d >= 0 && mtTextDepth($to) === d;
}

/** Already a target? (whole selection carries the mark → toggle shows active.) */
export function isTokenMarked(state: EditorState): boolean {
  const type = state.schema.marks[MTTOKEN_MARK];
  if (!type || !canMarkToken(state)) return false;
  const { from, to } = state.selection;
  return state.doc.rangeHasMark(from, to, type);
}

export function markToken(
  state: EditorState,
  dispatch: (tr: Transaction) => void,
): boolean {
  if (!canMarkToken(state)) return false;
  const type = state.schema.marks[MTTOKEN_MARK];
  if (!type) return false;
  return toggleMark(type)(state, dispatch);
}

export const markTokenAction: ItemSelectionAction = {
  key: "mark-token",
  label: "Mark target",
  isAvailable: canMarkToken,
  isActive: isTokenMarked,
  run: markToken,
};
