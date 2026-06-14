/**
 * Shared section lookup for the widgets that `sectionChromePlugin`
 * mounts inside each section (chrome, background, settings popover).
 *
 * Every widget receives `getPos()` — a position *inside* its section —
 * and needs the section node itself: the chrome to insert/move/delete,
 * the settings popover to read + write attrs, the background widget to
 * read the media attrs. Resolving from the widget position (instead of
 * caching a pos) keeps all of them correct after any doc edit.
 */

import type { Node as PmNode } from "prosemirror-model";
import type { EditorState } from "prosemirror-state";

export interface SectionInfo {
  /** Position of the section node itself in the doc. */
  pos: number;
  /** The section node, for reading attrs/content. */
  node: PmNode;
  /** Total node size, including the open + close tokens. */
  nodeSize: number;
}

/** Walks back from `widgetPos` (a position inside a section) to the
 *  enclosing section node. */
export function findEnclosingSection(
  state: EditorState,
  widgetPos: number,
): SectionInfo | null {
  const $pos = state.doc.resolve(widgetPos);
  for (let depth = $pos.depth; depth >= 0; depth--) {
    const node = $pos.node(depth);
    if (node.type.name !== "section") continue;
    const pos = depth === 0 ? 0 : $pos.before(depth);
    return { pos, node, nodeSize: node.nodeSize };
  }
  return null;
}

/** True when another section (not the one at `sectionPos`) already uses
 *  `htmlId`. Sections live inside pages now, so we scan all descendants
 *  (not just the doc's root children, which are pages). Sections are the
 *  only nodes carrying `htmlId`. Used by the ID field's soft validation —
 *  we warn rather than block, so typing toward a free name ("hero" →
 *  "hero-2") never fights. */
export function isHtmlIdTaken(
  state: EditorState,
  sectionPos: number,
  htmlId: string,
): boolean {
  if (!htmlId) return false;
  let taken = false;
  state.doc.descendants((node, pos) => {
    if (pos === sectionPos) return;
    if (node.type.name === "section" && node.attrs["htmlId"] === htmlId) {
      taken = true;
    }
  });
  return taken;
}
