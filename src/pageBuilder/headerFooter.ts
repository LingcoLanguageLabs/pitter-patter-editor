/**
 * Site-wide header / footer model — "pin to make global, detach to customize".
 *
 * The doc is `header? page+ footer?`: the doc's own header / footer are the
 * GLOBAL masters, rendered around every page. A page is `header? section+
 * footer?`, where a page-level header / footer is a PER-PAGE OVERRIDE (a
 * detached copy). So every page resolves to one of four states per bar:
 *
 *   • "global"   — no override, not hidden, a global exists → show the master
 *   • "override" — the page carries its own bar → show that (detached)
 *   • "hidden"   — `hideHeader` / `hideFooter` set, no override → show nothing
 *   • "none"     — no global exists and the page neither overrides nor hides
 *
 * The verbs map cleanly onto content moves:
 *   detach      = copy the global bar's content into the page
 *   reset       = delete the page's override (fall back to global)
 *   makeGlobal  = promote the page's override to the doc-level master
 *   hide / show = toggle the page's `hide*` flag (and drop any override)
 *
 * All the commands act on the ACTIVE page: only the active page's content is
 * mounted, so any bar chrome you can click belongs to either the doc-level
 * master (shown only while the active page inherits it) or the active page's
 * own override.
 */

import { Selection, type EditorState, type Transaction } from "prosemirror-state";
import type { Node as PmNode, Schema } from "prosemirror-model";
import type { EditorView } from "prosemirror-view";

import { activePageKey, getActivePageId, pageList, type PageEntry } from "./activePagePlugin";
import { FOOTER_TEMPLATES } from "./sections/footer";
import { HEADER_TEMPLATES } from "./sections/header";

export type BarKind = "header" | "footer";
export type BarScope = "global" | "override" | "hidden" | "none";

/** The page attr that suppresses each global bar. */
const HIDE_ATTR: Record<BarKind, "hideHeader" | "hideFooter"> = {
  header: "hideHeader",
  footer: "hideFooter",
};

// ── Lookups ──────────────────────────────────────────────────────────

/** The doc-level (global / master) bar of `kind`, or null. `doc.forEach` only
 *  visits direct children — pages + the two master bars — so this never matches
 *  a bar nested inside a page. The content model guarantees at most one. */
export function globalBar(
  doc: PmNode,
  kind: BarKind,
): { node: PmNode; pos: number } | null {
  let found: { node: PmNode; pos: number } | null = null;
  doc.forEach((node, offset) => {
    if (!found && node.type.name === kind) found = { node, pos: offset };
  });
  return found;
}

/** A page's own bar of `kind` (its override), or null. */
export function pageOverrideBar(
  page: PmNode,
  kind: BarKind,
): { node: PmNode; offset: number } | null {
  let found: { node: PmNode; offset: number } | null = null;
  page.forEach((child, offset) => {
    if (!found && child.type.name === kind) found = { node: child, offset };
  });
  return found;
}

/** Resolve what a page shows for `kind`. */
export function resolvePageBarScope(
  doc: PmNode,
  page: PmNode,
  kind: BarKind,
): BarScope {
  if (pageOverrideBar(page, kind)) return "override";
  if (page.attrs[HIDE_ATTR[kind]]) return "hidden";
  if (globalBar(doc, kind)) return "global";
  return "none";
}

/** Is the bar at `pos` a doc-level master (vs. a page-level override)? A master
 *  is a direct child of the doc, so its resolved depth is 1. */
export function isGlobalBarPos(doc: PmNode, pos: number): boolean {
  const $pos = doc.resolve(pos);
  // depth 0 = doc; a direct child sits at depth 0 with the node at $pos.nodeAfter.
  return $pos.depth === 0;
}

// ── Internal helpers ───────────────────────────────────────────────────

function activePage(state: EditorState): PageEntry | null {
  const pages = pageList(state.doc);
  const id = getActivePageId(state);
  return pages.find((p) => p.id === id) ?? pages[0] ?? null;
}

/** A fresh default bar (first template) — the fallback when detaching with no
 *  global master to copy from. */
function defaultBar(schema: Schema, kind: BarKind): PmNode {
  const json = kind === "header" ? HEADER_TEMPLATES[0] : FOOTER_TEMPLATES[0];
  return schema.nodeFromJSON(json);
}

function withHide(attrs: PmNode["attrs"], kind: BarKind, value: boolean) {
  return { ...attrs, [HIDE_ATTR[kind]]: value };
}

/** Dispatch `tr`, keeping `pageId` active and dropping the cursor safely inside
 *  it (so an edit that deleted the bar the cursor sat in doesn't strand it).
 *  Mirrors `pageCommands`' `commitWithActive`. */
function commit(view: EditorView, tr: Transaction, pageId: string): void {
  const entry = pageList(tr.doc).find((p) => p.id === pageId);
  let next = tr.setMeta(activePageKey, { activeId: pageId });
  if (entry) next = next.setSelection(Selection.near(next.doc.resolve(entry.pos + 1), 1));
  view.dispatch(next.scrollIntoView());
  view.focus();
}

// ── Commands (all act on the active page) ──────────────────────────────

/** Detach the active page from the global `kind`: give it a private copy it can
 *  edit without touching other pages. Copies the master's content (or the
 *  default template when no master exists). No-op if already detached. */
export function detachBar(view: EditorView, kind: BarKind): void {
  const { state } = view;
  const page = activePage(state);
  if (!page || pageOverrideBar(page.node, kind)) return;
  const barType = state.schema.nodes[kind]!;
  const src = globalBar(state.doc, kind)?.node ?? defaultBar(state.schema, kind);
  const copy = barType.create(src.attrs, src.content, src.marks);

  // Clear the hide flag first (setNodeMarkup leaves positions put), then drop
  // the override at the page top (header) / bottom (footer).
  let tr = state.tr.setNodeMarkup(page.pos, undefined, withHide(page.node.attrs, kind, false));
  const at = kind === "header" ? page.pos + 1 : page.pos + page.node.nodeSize - 1;
  tr = tr.insert(at, copy);
  commit(view, tr, page.id);
}

/** Reset the active page back to the global `kind`: drop its override (if any)
 *  and clear the hide flag, so it inherits the master again. */
export function resetBarToGlobal(view: EditorView, kind: BarKind): void {
  const { state } = view;
  const page = activePage(state);
  if (!page) return;
  let tr = state.tr.setNodeMarkup(page.pos, undefined, withHide(page.node.attrs, kind, false));
  const ov = pageOverrideBar(page.node, kind);
  if (ov) {
    const from = page.pos + 1 + ov.offset;
    tr = tr.delete(from, from + ov.node.nodeSize);
  }
  commit(view, tr, page.id);
}

/** Promote the active page's override `kind` to the doc-level master, replacing
 *  any existing master, then drop the override so the page inherits the new
 *  global (and every other inheriting page picks it up). No-op without an
 *  override to promote. */
export function makeBarGlobal(view: EditorView, kind: BarKind): void {
  const { state } = view;
  const page = activePage(state);
  if (!page) return;
  const ov = pageOverrideBar(page.node, kind);
  if (!ov) return;
  const barType = state.schema.nodes[kind]!;
  const overridePos = page.pos + 1 + ov.offset;
  const promoted = barType.create(ov.node.attrs, ov.node.content, ov.node.marks);

  let tr = state.tr;
  const g = globalBar(state.doc, kind);
  if (g) {
    tr = tr.replaceWith(g.pos, g.pos + g.node.nodeSize, promoted);
  } else if (kind === "header") {
    tr = tr.insert(0, promoted); // masters bookend: header first…
  } else {
    tr = tr.insert(state.doc.content.size, promoted); // …footer last
  }
  // The override + page positions shift past the doc-level edit — map them.
  const from = tr.mapping.map(overridePos, -1);
  tr = tr.delete(from, from + ov.node.nodeSize);
  const pagePos = tr.mapping.map(page.pos, -1);
  const pageNode = tr.doc.nodeAt(pagePos);
  if (pageNode?.type.name === "page") {
    tr = tr.setNodeMarkup(pagePos, undefined, withHide(pageNode.attrs, kind, false));
  }
  commit(view, tr, page.id);
}

/** Hide the global `kind` on the active page (title/cover page). Drops any
 *  override and sets the hide flag, so nothing renders for that bar here. */
export function hideBar(view: EditorView, kind: BarKind): void {
  const { state } = view;
  const page = activePage(state);
  if (!page) return;
  let tr = state.tr;
  const ov = pageOverrideBar(page.node, kind);
  if (ov) {
    const from = page.pos + 1 + ov.offset;
    tr = tr.delete(from, from + ov.node.nodeSize);
  }
  // Page pos is unaffected by an internal delete (its open token stays put).
  tr = tr.setNodeMarkup(page.pos, undefined, withHide(page.node.attrs, kind, true));
  commit(view, tr, page.id);
}

/** Un-hide: clear the active page's hide flag so it inherits the master again. */
export function showBar(view: EditorView, kind: BarKind): void {
  const { state } = view;
  const page = activePage(state);
  if (!page) return;
  const tr = state.tr.setNodeMarkup(
    page.pos,
    undefined,
    withHide(page.node.attrs, kind, false),
  );
  commit(view, tr, page.id);
}

/** Insert or replace the doc-level master bar (used by the Add-section modal,
 *  where picking a header/footer template sets the SITE-WIDE bar). */
export function setGlobalBar(view: EditorView, node: PmNode): void {
  const { state } = view;
  const kind = node.type.name as BarKind;
  if (kind !== "header" && kind !== "footer") return;
  const g = globalBar(state.doc, kind);
  let tr;
  if (g) {
    tr = state.tr.replaceWith(g.pos, g.pos + g.node.nodeSize, node);
  } else if (kind === "header") {
    tr = state.tr.insert(0, node);
  } else {
    tr = state.tr.insert(state.doc.content.size, node);
  }
  view.dispatch(tr.scrollIntoView());
  view.focus();
}
