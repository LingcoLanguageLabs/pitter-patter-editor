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
import type { EditorView } from "prosemirror-view";

import { getItemDefinition, itemNodeLabel } from "./items/registry";

export interface SectionInfo {
  /** Position of the section node itself in the doc. */
  pos: number;
  /** The section node, for reading attrs/content. */
  node: PmNode;
  /** Total node size, including the open + close tokens. */
  nodeSize: number;
}

/** Walks back from `widgetPos` to the nearest enclosing node whose type name
 *  is in `typeNames`. Generalises `findEnclosingSection` for the header/footer
 *  chrome, whose widgets need their own structural node (header or footer). */
export function findEnclosingOfType(
  state: EditorState,
  widgetPos: number,
  typeNames: readonly string[],
): SectionInfo | null {
  const $pos = state.doc.resolve(widgetPos);
  for (let depth = $pos.depth; depth >= 0; depth--) {
    const node = $pos.node(depth);
    if (!typeNames.includes(node.type.name)) continue;
    const pos = depth === 0 ? 0 : $pos.before(depth);
    return { pos, node, nodeSize: node.nodeSize };
  }
  return null;
}

/** Walks back from `widgetPos` (a position inside a section) to the
 *  enclosing section node. */
export function findEnclosingSection(
  state: EditorState,
  widgetPos: number,
): SectionInfo | null {
  return findEnclosingOfType(state, widgetPos, ["section"]);
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

export interface LinkableSection {
  /** Position of the section node in the doc. */
  pos: number;
  /** Current anchor id ("" if none assigned yet). */
  htmlId: string;
  /** The section's page title — the optgroup it's listed under. */
  pageTitle: string;
  /** The section's own label: its first heading, else "Section N" (its index
   *  within the page). */
  label: string;
}

/** Every section in the deck, document order. Pre-order traversal visits a page
 *  before its sections, so each section is attributed to the page it sits under
 *  (and numbered within it for the no-heading fallback). */
export function listSections(state: EditorState): LinkableSection[] {
  const out: LinkableSection[] = [];
  let pageTitle = "";
  let idxInPage = 0;
  state.doc.descendants((node, pos) => {
    const type = node.type.name;
    if (type === "page") {
      pageTitle = (node.attrs["title"] as string) || "Page";
      idxInPage = 0;
      return true;
    }
    if (type === "section") {
      idxInPage += 1;
      let heading = "";
      node.descendants((d) => {
        if (!heading && d.type.name === "heading") heading = d.textContent.trim();
      });
      out.push({
        pos,
        htmlId: (node.attrs["htmlId"] as string) || "",
        pageTitle: pageTitle || "Page",
        label: heading || `Section ${idxInPage}`,
      });
      // Sections don't nest; the heading is already captured, so don't descend.
      return false;
    }
    return true;
  });
  return out;
}

/** Group document-ordered rows by their `pageTitle` into consecutive runs, for
 *  an optgroup-per-page `<select>` (works even when two pages share a title). */
export function groupByPage<T extends { pageTitle: string }>(
  rows: T[],
): { pageTitle: string; rows: T[] }[] {
  const groups: { pageTitle: string; rows: T[] }[] = [];
  for (const r of rows) {
    let g = groups[groups.length - 1];
    if (!g || g.pageTitle !== r.pageTitle) {
      g = { pageTitle: r.pageTitle, rows: [] };
      groups.push(g);
    }
    g.rows.push(r);
  }
  return groups;
}

/** A gradable prompt (learning item) in the deck, for the Check-button "prompt"
 *  target picker. Labeled by its type + a snippet of its text. */
export interface LinkablePrompt {
  itemId: string;
  pageTitle: string;
  label: string;
}

export function listPrompts(state: EditorState): LinkablePrompt[] {
  const out: LinkablePrompt[] = [];
  let pageTitle = "";
  state.doc.descendants((node) => {
    if (node.type.name === "page") {
      pageTitle = (node.attrs["title"] as string) || "Page";
      return true;
    }
    if (getItemDefinition(node.type.name)) {
      const itemId = (node.attrs["itemId"] as string) || "";
      if (itemId) {
        const typeLabel = itemNodeLabel(node.type.name) || node.type.name;
        const snippet = node.textContent.trim().slice(0, 40);
        out.push({
          itemId,
          pageTitle,
          label: snippet ? `${typeLabel}: ${snippet}` : typeLabel,
        });
      }
      return false; // an item is a leaf for this listing
    }
    return true;
  });
  return out;
}

/** The section's anchor id, assigning a fresh unique one (and writing it to the
 *  doc) when it has none — so any section becomes linkable the moment it's
 *  chosen as a button's "Go to section" target. */
export function ensureSectionHtmlId(view: EditorView, pos: number): string {
  const node = view.state.doc.nodeAt(pos);
  if (!node || node.type.name !== "section") return "";
  const existing = (node.attrs["htmlId"] as string) || "";
  if (existing) return existing;
  let id = "";
  for (let i = 0; i < 50 && !id; i++) {
    const cand = `section-${Math.random().toString(36).slice(2, 7)}`;
    if (!isHtmlIdTaken(view.state, pos, cand)) id = cand;
  }
  if (!id) id = `section-${Date.now().toString(36)}`;
  view.dispatch(view.state.tr.setNodeAttribute(pos, "htmlId", id));
  return id;
}
