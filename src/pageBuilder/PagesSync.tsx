/**
 * Bridges the slide deck out to the zustand store for the Pages panel.
 *
 * The Pages panel lives outside the ProseMirror context, so it can't use
 * the editor hooks. This component (a child of `<ProseMirror>`) mirrors the
 * page list + active id into the store and stashes the live `view` so the
 * panel can dispatch deck operations. Same pattern as `ShuffleDragSync`.
 */

import {
  useEditorEffect,
  useEditorState,
} from "@handlewithcare/react-prosemirror";
import { useEffect } from "react";

import { getActivePageId, pageList } from "./activePagePlugin";
import { usePageBuilderStore } from "./store";

export function PagesSync() {
  const state = useEditorState();
  const setPages = usePageBuilderStore((s) => s.setPages);
  const setActivePageId = usePageBuilderStore((s) => s.setActivePageId);
  const setPagesView = usePageBuilderStore((s) => s.setPagesView);

  // Stash the live view for the panel to dispatch through; clear on unmount.
  useEditorEffect(
    (view) => {
      setPagesView(view);
    },
    [setPagesView],
  );
  useEffect(() => () => setPagesView(null), [setPagesView]);

  const pages = pageList(state.doc).map(({ id, title }) => ({ id, title }));
  const activeId = getActivePageId(state);

  // Push only when the deck or active slide actually changes.
  const signature = JSON.stringify({ pages, activeId });
  useEffect(() => {
    setPages(pages);
    setActivePageId(activeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, setPages, setActivePageId]);

  return null;
}
