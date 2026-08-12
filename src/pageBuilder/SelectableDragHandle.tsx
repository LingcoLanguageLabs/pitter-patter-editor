/**
 * Drag-handle pill that also selects its block on click.
 *
 * This is the `handleComponent` we hand to shuffle's `<DragHandles>`. It's
 * deliberately just shuffle's default pill (same `.shuffle-drag-handle` class,
 * same type-label, same forwarded `onPointerDown` so dragging is unchanged)
 * plus one thing: an `onClick` that selects the block. That's the only
 * reliable way to select a container — its children fill its box, so a click
 * in the canvas always resolves to the inner block, never the container.
 *
 * Shuffle's `DragHandleProps` doesn't include the doc position, so we recover
 * it by matching the handle's `node` against the hovered ancestor stack
 * (`hoverPositions`). The stack is one node per depth, so the match is
 * unambiguous. A plain click never starts a drag (shuffle only commits one on
 * pointer movement), so it falls through to `onClick`.
 */

import {
  useEditorEventCallback,
  useEditorState,
} from "@handlewithcare/react-prosemirror";
import { type DragHandleProps, shufflePluginKey } from "@pitter-patter/shuffle";

import { selectBlockPos } from "./blockHighlightPlugin";
import { itemNodeLabel } from "./items/registry";

export function SelectableDragHandle({
  style,
  node,
  onPointerDown,
}: DragHandleProps) {
  const state = useEditorState();
  const positions = shufflePluginKey.getState(state)?.hoverPositions ?? [];
  const match = positions.find(
    ({ from }) => state.doc.resolve(from).nodeAfter === node,
  );
  const pos = match ? match.from : null;

  const select = useEditorEventCallback((view) => {
    if (pos != null) selectBlockPos(view, pos);
  });

  return (
    <button
      type="button"
      className="shuffle-drag-handle"
      style={style}
      draggable="false"
      onPointerDown={onPointerDown}
      onClick={select}
    >
      {itemNodeLabel(node.type.name) ?? node.type.name}
    </button>
  );
}
