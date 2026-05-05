import { lift, wrapIn } from "prosemirror-commands";
import { InputRule } from "prosemirror-inputrules";
import type { Attrs, MarkType, Node as PmNode, NodeType } from "prosemirror-model";
import { liftListItem, splitListItem, wrapInList } from "prosemirror-schema-list";
import type { Command, EditorState } from "prosemirror-state";
import { canJoin, findWrapping } from "prosemirror-transform";

export function isMarkActive(editorState: EditorState | null, markType: MarkType): boolean {
  if (!editorState) return false;
  const { $head, from, to, empty } = editorState.selection;
  return empty
    ? !!markType.isInSet(editorState.storedMarks || $head.marks())
    : editorState.doc.rangeHasMark(from, to, markType);
}

export function isTextblockActive(
  editorState: EditorState | null,
  nodeType: NodeType,
  attrs?: Record<string, unknown>,
): boolean {
  if (!editorState) return false;
  const { $from } = editorState.selection;
  const parent = $from.parent;
  if (parent.type !== nodeType) return false;
  if (!attrs) return true;
  return Object.entries(attrs).every(([key, value]) => parent.attrs[key] === value);
}

export function isAncestorActive(
  editorState: EditorState | null,
  nodeType: NodeType,
): boolean {
  if (!editorState) return false;
  const { $from } = editorState.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    if ($from.node(depth).type === nodeType) return true;
  }
  return false;
}

export function toggleWrap(nodeType: NodeType): Command {
  return (state, dispatch, view) => {
    if (isAncestorActive(state, nodeType)) {
      return lift(state, dispatch);
    }
    return wrapIn(nodeType)(state, dispatch, view);
  };
}

export function toggleList(listType: NodeType, itemType: NodeType): Command {
  return (state, dispatch, view) => {
    const { $from } = state.selection;

    let inTargetList = false;
    let otherListInfo: { pos: number } | null = null;

    for (let depth = $from.depth; depth > 0; depth--) {
      const node = $from.node(depth);
      if (node.type === listType) {
        inTargetList = true;
        break;
      }
      if (node.type.spec.group?.includes("list")) {
        otherListInfo = { pos: $from.before(depth) };
      }
    }

    if (inTargetList) {
      return liftListItem(itemType)(state, dispatch);
    }
    if (otherListInfo) {
      if (dispatch) {
        dispatch(state.tr.setNodeMarkup(otherListInfo.pos, listType));
      }
      return true;
    }
    return wrapInList(listType)(state, dispatch, view);
  };
}

type AttrsArg = Attrs | null | ((match: RegExpMatchArray) => Attrs | null);

export function smartListInputRule(
  regexp: RegExp,
  listType: NodeType,
  getAttrs?: AttrsArg,
  joinPredicate?: (match: RegExpMatchArray, node: PmNode) => boolean,
): InputRule {
  return new InputRule(regexp, (state, match, start, end) => {
    const attrs = typeof getAttrs === "function" ? getAttrs(match) : (getAttrs ?? null);
    const $start = state.doc.resolve(start);

    for (let depth = $start.depth; depth > 0; depth--) {
      const node = $start.node(depth);
      const group = node.type.spec.group;
      if (group?.includes("list")) {
        if (node.type === listType) return null;
        const listPos = $start.before(depth);
        return state.tr.setNodeMarkup(listPos, listType, attrs).delete(start, end);
      }
    }

    const tr = state.tr.delete(start, end);
    const range = tr.doc.resolve(start).blockRange();
    if (!range) return null;
    const wrapping = findWrapping(range, listType, attrs);
    if (!wrapping) return null;
    tr.wrap(range, wrapping);
    const before = tr.doc.resolve(start - 1).nodeBefore;
    if (
      before &&
      before.type === listType &&
      canJoin(tr.doc, start - 1) &&
      (!joinPredicate || joinPredicate(match, before))
    ) {
      tr.join(start - 1);
    }
    return tr;
  });
}

export function smartSplitListItem(itemType: NodeType): Command {
  return (state, dispatch, view) => {
    const { $from, $to } = state.selection;
    if (!$from.sameParent($to)) return false;

    let itemDepth = -1;
    for (let depth = $from.depth; depth > 0; depth--) {
      if ($from.node(depth).type === itemType) {
        itemDepth = depth;
        break;
      }
    }
    if (itemDepth < 0) return splitListItem(itemType)(state, dispatch, view);

    const item = $from.node(itemDepth);
    const isEmptyItem =
      item.childCount === 1 &&
      item.firstChild?.type.name === "paragraph" &&
      item.firstChild.content.size === 0;

    if (isEmptyItem) {
      return liftListItem(itemType)(state, dispatch);
    }
    return splitListItem(itemType)(state, dispatch, view);
  };
}
