/**
 * Generates (and keeps fresh) a thumbnail for EVERY page — not just the
 * active one — so the Pages rail and the future flowchart canvas always show
 * the real page, never a placeholder.
 *
 * How it stays cheap (and non-blocking):
 *   • The ACTIVE page is captured from the LIVE on-screen editor (`view.dom`),
 *     NOT a second editor instance — it's already rendered, so we just
 *     rasterize it (editing chrome stripped at capture time). Only pages that
 *     are off-screen pay for a hidden `PageSnapshotStage` render.
 *   • All snapshot work is debounced (a burst of edits → one pass) and
 *     deferred to `requestIdleCallback`, so it never competes with typing or
 *     navigation — it runs when the main thread is free.
 *   • One capture (live or off-screen) runs at a time; the active page jumps
 *     the queue, so the thumbnail you're most likely looking at refreshes first.
 *   • Dirty-tracking is by ProseMirror node *reference*. PM reuses unchanged
 *     subtrees across transactions, so a page whose node object is identical
 *     to the last one we snapshotted hasn't changed — we skip it. Editing one
 *     page only re-renders that page; reordering/renaming touches no
 *     content nodes, so nothing re-renders.
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
import { snapshotPage } from "./pageSnapshot";
import { PageSnapshotStage } from "./PageSnapshotStage";
import { usePageBuilderStore } from "./store";

/** Coalesce a burst of edits into one snapshot pass (don't snapshot per
 *  keystroke). */
const DEBOUNCE_MS = 350;
/** rIC deadline: snapshotting waits for an idle thread but is guaranteed to run
 *  within this window even under sustained load. */
const IDLE_TIMEOUT = 1500;

/** Run `fn` when the main thread is idle so snapshotting never blocks typing or
 *  navigation. Falls back to a short timeout where requestIdleCallback is
 *  unavailable. */
function onIdle(fn: () => void): void {
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(() => fn(), { timeout: IDLE_TIMEOUT });
  } else {
    setTimeout(fn, 200);
  }
}

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
  const setPageThumb = usePageBuilderStore((s) => s.setPageThumb);

  /** Last signature we successfully kicked off a snapshot for, per page id. */
  const doneRef = useRef<Map<string, Sig>>(new Map());
  /** Pages whose current signature differs from `done` → awaiting a snapshot. */
  const pendingRef = useRef<Map<string, Sig>>(new Map());
  /** A capture (live OR off-screen stage) is in flight — gate so only one runs
   *  at a time, regardless of which path. */
  const runningRef = useRef(false);
  /** Off-screen job (NON-active pages only) driving `<PageSnapshotStage>`. */
  const [job, setJob] = useState<Job | null>(null);

  // Latest activeId, readable from the deferred (idle) capture callback so it
  // never saves the wrong page if you navigate away before it runs.
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;
  // pump is invoked from async callbacks; keep a stable handle to the latest.
  const pumpRef = useRef<() => void>(() => {});

  const markDone = useCallback((id: string, sig: Sig) => {
    doneRef.current.set(id, sig);
    if (pendingRef.current.get(id) === sig) pendingRef.current.delete(id);
  }, []);

  const pump = useCallback(() => {
    if (runningRef.current || job || !view) return; // one capture at a time
    if (pendingRef.current.size === 0) return;
    // Prefer the page on screen; otherwise take any pending one.
    const id =
      activeId && pendingRef.current.has(activeId)
        ? activeId
        : (pendingRef.current.keys().next().value as string);
    const sig = pendingRef.current.get(id)!;
    runningRef.current = true;

    if (id === activeId) {
      // The active page is already rendered on screen — snapshot the LIVE
      // editor (`view.dom` is the `.ProseMirror`: global header + active page +
      // footer) instead of mounting a second editor just to re-render it.
      // Editing chrome is stripped at capture time (pageSnapshot's filter).
      onIdle(async () => {
        // Bail if we navigated away mid-wait: the live DOM is now a different
        // page; leave this one pending and let the queue re-pick it (off-screen).
        if (activeIdRef.current !== id) {
          runningRef.current = false;
          pumpRef.current();
          return;
        }
        try {
          const url = await snapshotPage(view.dom as HTMLElement);
          if (url && activeIdRef.current === id) setPageThumb(id, url);
        } catch {
          /* swallow — advance the queue regardless */
        } finally {
          markDone(id, sig);
          runningRef.current = false;
          pumpRef.current();
        }
      });
    } else {
      // Not on screen → render it off-screen once, scheduled at idle.
      const node = buildSyntheticPage(sig);
      const canvas = view.dom.closest(".pb-canvas") as HTMLElement | null;
      const width = canvas?.clientWidth || 960;
      onIdle(() => setJob({ id, node, sig, width }));
    }
  }, [view, activeId, job, setPageThumb, markDone]);
  pumpRef.current = pump;

  // Recompute the dirty set when the deck changes — debounced so a burst of
  // edits coalesces into one snapshot after you pause (never one per keystroke).
  useEffect(() => {
    if (!view) return;
    const t = setTimeout(() => {
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
      pumpRef.current();
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
    // pumpRef (not pump) is used inside, so job churn doesn't reset the timer.
  }, [pages, activeId, view]);

  const handleDone = useCallback(
    (id: string) => {
      // Record the signature we just rendered; if it's still the latest for
      // that id, it's no longer pending. (A mid-render change replaces the
      // pending Sig with a fresh object, so the reference check re-runs it.)
      setJob((current) => {
        if (current && current.id === id) markDone(id, current.sig);
        return null;
      });
      runningRef.current = false;
    },
    [markDone],
  );

  // When the off-screen job clears, start the next one (here, not in
  // handleDone, so `pump` reads the post-render null `job`).
  useEffect(() => {
    if (!job) pumpRef.current();
  }, [job]);

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
