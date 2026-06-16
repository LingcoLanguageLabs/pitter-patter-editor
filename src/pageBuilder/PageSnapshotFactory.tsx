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
 * from the store mirror (`editorStoreSyncPlugin` → `pages` / `pagesView`).
 *
 * Deferred: visible-first ordering via IntersectionObserver and list
 * virtualization for very large decks — the queue already scales (sequential,
 * cached), these are refinements for 100s of pages.
 */

import type { Node as PmNode } from "prosemirror-model";
import { useCallback, useEffect, useRef, useState } from "react";

import { pageList } from "./activePagePlugin";
import { globalBar, resolvePageBarScope } from "./headerFooter";
import { PageSnapshotStage } from "./PageSnapshotStage";
import { usePageBuilderStore } from "./store";

/** What a page's thumbnail depends on: the page node plus whichever global
 *  masters it inherits (so editing a master refreshes every page that shows
 *  it). PM reuses unchanged nodes across transactions, so reference equality on
 *  these three is an exact dirty check. */
interface Sig {
  page: PmNode;
  header: PmNode | null;
  footer: PmNode | null;
}

function sameSig(a: Sig | undefined, b: Sig): boolean {
  return !!a && a.page === b.page && a.header === b.header && a.footer === b.footer;
}

/** The thumbnail dependencies for one page: its node, and the global header /
 *  footer ONLY when the page actually inherits them (scope "global"). An
 *  override bar already lives inside the page node; a hidden/none bar shows
 *  nothing. */
function pageSig(doc: PmNode, page: PmNode): Sig {
  const header =
    resolvePageBarScope(doc, page, "header") === "global"
      ? (globalBar(doc, "header")?.node ?? null)
      : null;
  const footer =
    resolvePageBarScope(doc, page, "footer") === "global"
      ? (globalBar(doc, "footer")?.node ?? null)
      : null;
  return { page, header, footer };
}

/** A page node to snapshot — the real one, or (when it inherits a master) a
 *  synthetic copy with the master bars injected as children so the `.pb-page`
 *  capture region includes them. The page content model (`header? section+
 *  footer?`) makes prepending a header / appending a footer valid. */
function buildSyntheticPage(sig: Sig): PmNode {
  if (!sig.header && !sig.footer) return sig.page;
  const children: PmNode[] = [];
  if (sig.header) children.push(sig.header);
  sig.page.forEach((child) => children.push(child));
  if (sig.footer) children.push(sig.footer);
  return sig.page.type.create(sig.page.attrs, children, sig.page.marks);
}

interface Job {
  id: string;
  node: PmNode;
  /** Source signature this job rendered — kept so `handleDone` can record it as
   *  done and detect a mid-render change (a fresh Sig replaced it in pending). */
  sig: Sig;
  width: number;
}

export function PageSnapshotFactory() {
  // `pages` / `activePageId` change on every doc edit + navigation; we use
  // them only as a trigger and read the authoritative nodes off the view.
  const pages = usePageBuilderStore((s) => s.pages);
  const activeId = usePageBuilderStore((s) => s.activePageId);
  const view = usePageBuilderStore((s) => s.pagesView);

  /** Last signature we successfully kicked off a snapshot for, per page id. */
  const doneRef = useRef<Map<string, Sig>>(new Map());
  /** Pages whose current signature differs from `done` → awaiting a snapshot. */
  const pendingRef = useRef<Map<string, Sig>>(new Map());

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
      const sig = pendingRef.current.get(id)!;
      const node = buildSyntheticPage(sig);
      const canvas = view.dom.closest(".pb-canvas") as HTMLElement | null;
      const width = canvas?.clientWidth || 960;
      return { id, node, sig, width };
    });
  }, [view, activeId]);

  // Recompute the dirty set whenever the deck changes, then pump the queue.
  useEffect(() => {
    if (!view) return;
    const { doc } = view.state;
    const list = pageList(doc);
    const liveIds = new Set(list.map((p) => p.id));
    for (const id of [...doneRef.current.keys()])
      if (!liveIds.has(id)) doneRef.current.delete(id);
    for (const id of [...pendingRef.current.keys()])
      if (!liveIds.has(id)) pendingRef.current.delete(id);
    for (const p of list) {
      if (!p.id) continue;
      const sig = pageSig(doc, p.node);
      if (!sameSig(doneRef.current.get(p.id), sig))
        pendingRef.current.set(p.id, sig);
    }
    pump();
  }, [pages, activeId, view, pump]);

  const handleDone = useCallback((id: string) => {
    // Record the signature we just rendered; if it's still the latest for that
    // id, it's no longer pending. (If the page or a master it inherits changed
    // mid-render, the dirty pass replaced the pending Sig with a fresh object,
    // so the reference check fails and it re-runs.)
    setJob((current) => {
      if (current && current.id === id) {
        doneRef.current.set(id, current.sig);
        if (pendingRef.current.get(id) === current.sig)
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
