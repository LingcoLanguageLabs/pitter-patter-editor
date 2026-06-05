/**
 * Mirrors shuffle's drag-in-progress flag into our UI store.
 *
 * Shuffle sets `activeNodePos` on its plugin state for the lifetime
 * of a drag. We expose that as `store.isDragging` so any React
 * component (section chrome, canvas actions, future overlays) can
 * read a plain boolean instead of poking at shuffle's plugin state
 * — and so non-React code paths (CSS selectors) don't have to fight
 * `:has()`-style gating against shuffle internals.
 *
 * Mirrors pagy's `store.draggedBlock` pattern (see `pagy.co/src/
 * editor/application-shell.tsx`). Mounts as a child of `<ProseMirror>`
 * in `Editor.tsx` because it needs `useEditorState` access.
 */

import { useEditorState } from "@handlewithcare/react-prosemirror";
import { shufflePluginKey } from "@pitter-patter/shuffle";
import { useEffect } from "react";

import { usePageBuilderStore } from "./store";

export function ShuffleDragSync() {
  const state = useEditorState();
  const isDragging = !!shufflePluginKey.getState(state)?.activeNodePos;
  const setIsDragging = usePageBuilderStore((s) => s.setIsDragging);
  useEffect(() => {
    setIsDragging(isDragging);
  }, [isDragging, setIsDragging]);
  return null;
}
