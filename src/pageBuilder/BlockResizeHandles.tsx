/**
 * Resize handles pinned to the *active* block — the one carrying the explicit
 * selection ring (`blockHighlightPlugin`), NOT the raw ProseMirror selection.
 *
 * Why not shuffle's own `<ResizeHandles>`? It derives its target by walking UP
 * from the PM text selection to the innermost resizable node. That can never
 * reach a `container`: a container's children fill its box, so the cursor
 * always sits inside a child block, and the walk stops at that child. Containers
 * are selected via their drag-handle pill (`SelectableDragHandle` →
 * `selectBlockPos`), which sets the explicit `selected` state but no PM
 * `NodeSelection` — so shuffle's selection-driven handles and our ring pointed
 * at different nodes, and a selected container showed handles on a child
 * instead of on itself.
 *
 * Driving the handles off `getActiveBlockPos` unifies the two channels: the
 * block you see ringed is the block whose edges you grab. We reuse shuffle's
 * `useResizeHandlePointerDown` (the identical grid-span resize transform) and
 * its `.shuffle-left/right-resize-handle` class names, so shuffle's styling
 * plus the resize-state detection and keep-alive selectors in
 * `blockHighlightPlugin` keep firing unchanged.
 *
 * Migration seam: once shuffle exposes a `selectedPos` API, the selection walk
 * in `ResizeHandles` can key off it and this component collapses back to
 * `<ResizeHandles />`. See the TODO(shuffle selectedPos API) notes.
 */

import { useEditorEffect, useEditorState } from "@handlewithcare/react-prosemirror";
import {
  shufflePluginKey,
  supportsResize,
  useResizeHandlePointerDown,
} from "@pitter-patter/shuffle";
import type { Node } from "prosemirror-model";
import { useState } from "react";

import { getActiveBlockPos } from "./blockHighlightPlugin";

export function BlockResizeHandles() {
  const state = useEditorState();
  const shuffleState = shufflePluginKey.getState(state);
  const pos = getActiveBlockPos(state);
  const node = pos == null ? null : state.doc.nodeAt(pos);

  // A single-column stack (mobile) has nothing to resize — mirror shuffle's own
  // `multiColumn` gate. Hide mid-drag (a block is being repositioned). And only
  // a resizable node gets handles (sections/atoms with no grid span don't).
  if (pos == null || node == null) return null;
  if (shuffleState?.multiColumn === false) return null;
  if (shuffleState?.activeNodePos != null) return null;
  if (!supportsResize(node)) return null;

  return (
    <>
      <BlockResizeHandle pos={pos} node={node} side="start" />
      <BlockResizeHandle pos={pos} node={node} side="end" />
    </>
  );
}

function BlockResizeHandle({
  pos,
  node,
  side,
}: {
  pos: number;
  node: Node;
  side: "start" | "end";
}) {
  const [left, setLeft] = useState(0);
  const [top, setTop] = useState(0);

  // Re-positions whenever the node instance changes (e.g. its grid span shifts
  // during a resize) — same dependency shuffle's own handles use.
  useEditorEffect(
    (view) => {
      const nodeDOM = view.nodeDOM(pos);
      if (!(nodeDOM instanceof HTMLElement)) return;
      const rect = nodeDOM.getBoundingClientRect();
      // Handles are positioned relative to the shuffle wrapper (there may be
      // more than one shuffle editor on the page, so scope to this one).
      const wrapper = view.dom.closest("[data-shuffle-wrapper]");
      const offset = wrapper?.getBoundingClientRect();
      const offsetLeft = offset?.left ?? 0;
      const offsetTop = offset?.top ?? 0;
      setLeft(
        side === "start"
          ? rect.left - 8 - offsetLeft
          : rect.right + 8 - offsetLeft,
      );
      setTop((rect.top + rect.bottom) / 2 - offsetTop);
    },
    [pos, node, side],
  );

  const onPointerDown = useResizeHandlePointerDown(pos, side);

  return (
    <button
      type="button"
      className={
        side === "start"
          ? "shuffle-left-resize-handle"
          : "shuffle-right-resize-handle"
      }
      style={{ left, top }}
      onPointerDown={onPointerDown}
      draggable="false"
    />
  );
}
