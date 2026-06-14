/**
 * Generates (and keeps fresh) a thumbnail for EVERY page — not just the
 * active one — so the Pages rail and the future flowchart canvas always show
 * the real page, never a placeholder.
 *
 * How it stays cheap:
 *   • One page is rendered off-screen at a time (`PageSnapshotStage`), so
 *     peak cost is a single hidden page, never the whole deck.
 *   • Dirty-tracking is by ProseMirror node *reference*. PM reuses unchanged
 *     subtrees across transactions, so a page whose node object is identical
 *     to the last one we snapshotted hasn't changed — we skip it. Editing one
 *     page only re-renders that page; reordering/renaming touches no
 *     content nodes, so nothing re-renders.
 *   • The active page jumps the queue, so the thumbnail you're most likely
 *     looking at refreshes first.
 *
 * Lives OUTSIDE the main `<ProseMirror>` (it mounts its own), reading the deck
 * from the store mirror (`PagesSync` → `pages` / `pagesView`).
 *
 * Deferred: visible-first ordering via IntersectionObserver and list
 * virtualization for very large decks — the queue already scales (sequential,
 * cached), these are refinements for 100s of pages.
 */

import type { Node as PmNode } from "prosemirror-model";
import { useCallback, useEffect, useRef, useState } from "react";

import { pageList } from "./activePagePlugin";
import { PageSnapshotStage } from "./PageSnapshotStage";
import { usePageBuilderStore } from "./store";

interface Job {
  id: string;
  node: PmNode;
  width: number;
}

export function PageSnapshotFactory() {
  // `pages` / `activePageId` change on every doc edit + navigation; we use
  // them only as a trigger and read the authoritative nodes off the view.
  const pages = usePageBuilderStore((s) => s.pages);
  const activeId = usePageBuilderStore((s) => s.activePageId);
  const view = usePageBuilderStore((s) => s.pagesView);

  /** Last node we successfully kicked off a snapshot for, per page id. */
  const doneRef = useRef<Map<string, PmNode>>(new Map());
  /** Pages whose current node differs from `done` → awaiting a snapshot. */
  const pendingRef = useRef<Map<string, PmNode>>(new Map());

  const [job, setJob] = useState<Job | null>(null);

  const pump = useCallback(() => {
    setJob((current) => {
      if (current) return current; // a page is already rendering
      if (!view || pendingRef.current.size === 0) return null;
      // Prefer the page on screen; otherwise take any pending one.
      const id =
        activeId && pendingRef.current.has(activeId)
          ? activeId
          : (pendingRef.current.keys().next().value as string);
      const node = pendingRef.current.get(id)!;
      const canvas = view.dom.closest(".pb-canvas") as HTMLElement | null;
      const width = canvas?.clientWidth || 960;
      return { id, node, width };
    });
  }, [view, activeId]);

  // Recompute the dirty set whenever the deck changes, then pump the queue.
  useEffect(() => {
    if (!view) return;
    const list = pageList(view.state.doc);
    const liveIds = new Set(list.map((p) => p.id));
    for (const id of [...doneRef.current.keys()])
      if (!liveIds.has(id)) doneRef.current.delete(id);
    for (const id of [...pendingRef.current.keys()])
      if (!liveIds.has(id)) pendingRef.current.delete(id);
    for (const p of list) {
      if (!p.id) continue;
      if (doneRef.current.get(p.id) !== p.node)
        pendingRef.current.set(p.id, p.node);
    }
    pump();
  }, [pages, activeId, view, pump]);

  const handleDone = useCallback((id: string) => {
    // Record what we just rendered; if it's still the latest for that id,
    // it's no longer pending. (If the page changed again mid-render, the
    // pending entry now holds the newer node and will re-run.)
    setJob((current) => {
      if (current && current.id === id) {
        doneRef.current.set(id, current.node);
        if (pendingRef.current.get(id) === current.node)
          pendingRef.current.delete(id);
      }
      return null;
    });
  }, []);

  // When a job clears, start the next one.
  useEffect(() => {
    if (!job) pump();
  }, [job, pump]);

  if (!job) return null;
  return (
    <PageSnapshotStage
      key={job.id}
      pageId={job.id}
      pageNode={job.node}
      width={job.width}
      onDone={handleDone}
    />
  );
}
