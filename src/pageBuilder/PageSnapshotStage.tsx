/**
 * Off-screen renderer for ONE page, used by `PageSnapshotFactory` to
 * generate thumbnails for pages that aren't the active one.
 *
 * Fidelity comes from rendering the page through a *real* (but hidden,
 * trimmed) ProseMirror — same schema, same NodeViews, plus the plugins that
 * produce visual classes (`attrClassesPlugin`) and shuffle's column / grid
 * layout. A single-page doc works because `activePagePlugin` marks the lone
 * page active, so `PageNodeView` mounts its content. We deliberately DROP the
 * editing chrome (section affordances, drag/resize handles, placeholders,
 * hover rings) so the thumbnail is the clean rendered page.
 *
 * The host reproduces the canvas DOM chain — `.pb-canvas.site` (theme vars +
 * background) → `.pb-canvas-scroll` (the `.ProseMirror` text styling is scoped
 * under it) — at the live canvas width, so layout matches the editor exactly.
 * Once fonts + layout settle we snapshot the `.pb-page` and report back.
 */

import {
  ProseMirror,
  ProseMirrorDoc,
  reactKeys,
} from "@handlewithcare/react-prosemirror";
import { ShuffleSkeleton, shuffle } from "@pitter-patter/shuffle";
import type { Node as PmNode } from "prosemirror-model";
import { EditorState } from "prosemirror-state";
import { useEffect, useMemo, useRef } from "react";

import { activePagePlugin } from "./activePagePlugin";
import { attrClassesPlugin } from "./attrClassesPlugin";
import { nodeViewComponents } from "./nodeViews";
import { snapshotPage } from "./pageSnapshot";
import { usePageBuilderStore } from "./store";
import { themeClassName } from "./theme/css";

export interface PageSnapshotStageProps {
  pageId: string;
  /** The page node to render — its content is snapshotted as-is. */
  pageNode: PmNode;
  /** Live canvas width (px) so the off-screen grid lays out identically. */
  width: number;
  /** Called once a snapshot attempt finishes (success or not), so the
   *  factory can advance its queue. Must be stable. */
  onDone: (id: string) => void;
}

export function PageSnapshotStage({
  pageId,
  pageNode,
  width,
  onDone,
}: PageSnapshotStageProps) {
  const setPageThumb = usePageBuilderStore((s) => s.setPageThumb);
  const theme = usePageBuilderStore((s) => s.theme);
  const hostRef = useRef<HTMLDivElement>(null);

  // A single-page doc on the SAME schema the page node came from (node types
  // carry a schema reference, so we can't build a fresh schema here).
  const state = useMemo(() => {
    const schema = pageNode.type.schema;
    return EditorState.create({
      doc: schema.node("doc", null, [pageNode]),
      plugins: [
        reactKeys(),
        shuffle({}),
        activePagePlugin(),
        attrClassesPlugin(),
      ],
    });
  }, [pageNode]);

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host) {
      onDone(pageId);
      return;
    }
    const run = async () => {
      // Wait for webfonts (Karla et al.) so text metrics match the canvas.
      try {
        await document.fonts?.ready;
      } catch {
        /* fonts API absent — proceed */
      }
      if (cancelled) return;
      // A short settle for layout to flush. Deliberately a timeout, not
      // requestAnimationFrame: rAF is suspended in background/hidden tabs, so
      // an rAF-gated snapshot would never run there (and stall the queue).
      await new Promise<void>((r) => setTimeout(r, 80));
      if (cancelled) return;
      // Always report done (in `finally`) so a failed/empty snapshot advances
      // the factory's queue instead of stalling it on this page forever.
      try {
        const el = host.querySelector(".pb-page") as HTMLElement | null;
        if (el) {
          const url = await snapshotPage(el);
          if (!cancelled && url) setPageThumb(pageId, url);
        }
      } finally {
        if (!cancelled) onDone(pageId);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
    // pageNode is constant for this mount (the factory remounts per page),
    // so keying the effect on pageId is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId]);

  return (
    <div
      ref={hostRef}
      aria-hidden
      className={`pb-snapshot-stage pb-canvas site ${themeClassName(theme)}`}
      style={{ width }}
    >
      <div className="pb-canvas-scroll">
        <ProseMirror defaultState={state} nodeViewComponents={nodeViewComponents}>
          <ShuffleSkeleton>
            <ProseMirrorDoc />
          </ShuffleSkeleton>
        </ProseMirror>
      </div>
    </div>
  );
}
