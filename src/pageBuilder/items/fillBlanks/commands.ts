/**
 * Fill Blanks — the "Mark as blank" selection action. Available when a non-empty
 * text selection sits inside a single fb stem and doesn't already cross a blank;
 * running it replaces the selected text with a blank node (answer = that text).
 * Contributed to the selection toolbar via the item registry.
 */

import type { EditorState, Transaction } from "prosemirror-state";

import type { ItemSelectionAction } from "../types";
import { makeBlank } from "./create";
import { BLANK_NODE, FB_NODE } from "./schema";

/** Depth of the nearest fb ancestor of `$pos`, or -1. */
function fbDepth($pos: EditorState["selection"]["$from"]): number {
  for (let d = $pos.depth; d > 0; d--) {
    if ($pos.node(d).type.name === FB_NODE) return d;
  }
  return -1;
}

/** True iff the whole selection is plain text inside ONE fb question. */
export function canMarkBlank(state: EditorState): boolean {
  const { selection } = state;
  const { $from, $to, empty } = selection;
  if (empty) return false;
  if (!state.doc.textBetween(selection.from, selection.to).trim()) return false;
  const d = fbDepth($from);
  if (d < 0 || fbDepth($to) !== d) return false;
  // Refuse if the range already contains a blank (no nested blanks).
  let hasBlank = false;
  state.doc.nodesBetween(selection.from, selection.to, (node) => {
    if (node.type.name === BLANK_NODE) hasBlank = true;
  });
  return !hasBlank;
}

export function markBlank(
  state: EditorState,
  dispatch: (tr: Transaction) => void,
): boolean {
  if (!canMarkBlank(state)) return false;
  const { from, to } = state.selection;
  const text = state.doc.textBetween(from, to);
  const blank = makeBlank(state.schema, text);
  const tr = state.tr.replaceRangeWith(from, to, blank);
  dispatch(tr.scrollIntoView());
  return true;
}

export const markBlankAction: ItemSelectionAction = {
  key: "mark-blank",
  label: "Blank",
  isAvailable: canMarkBlank,
  run: markBlank,
};
