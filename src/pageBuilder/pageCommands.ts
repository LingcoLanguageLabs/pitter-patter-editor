/**
 * Deck operations driven by the Pages panel — add / duplicate / delete /
 * reorder slides. Each builds one transaction, sets the active slide
 * (via `activePageKey` meta), and moves the selection into the resulting
 * page so the cursor is never stranded in an unmounted slide.
 *
 * Pages are the doc's direct children, so these operate at the doc root
 * (mirrors `SectionChromeWidget`'s within-page section ops, one level up).
 */

import { Selection } from "prosemirror-state";
import type { Schema, Node as PmNode } from "prosemirror-model";
import type { EditorView } from "prosemirror-view";

import { activePageKey, getActivePageId, pageList } from "./activePagePlugin";
import type { TransitionSpeed, TransitionType } from "./transitions";

/** A stable id for a new page. */
function newPageId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `page-${Date.now().toString(36)}`;
}

/** A fresh slide: one empty section with an empty paragraph. */
function createPageNode(schema: Schema, title = "Untitled"): PmNode {
  const page = schema.nodes["page"]!;
  const section = schema.nodes["section"]!;
  const paragraph = schema.nodes["paragraph"]!;
  return page.create({ id: newPageId(), title }, [
    section.create(null, paragraph.create(null)),
  ]);
}

/** Dispatch `tr` after activating `id` and dropping the cursor inside that
 *  page (just past its open token, at `pagePos + 1`). */
function commitWithActive(view: EditorView, tr: import("prosemirror-state").Transaction, id: string): void {
  const entry = pageList(tr.doc).find((p) => p.id === id);
  let next = tr.setMeta(activePageKey, { activeId: id });
  if (entry) next = next.setSelection(Selection.near(next.doc.resolve(entry.pos + 1), 1));
  view.dispatch(next.scrollIntoView());
  view.focus();
}

/** Add a new blank slide after `afterId` (else after the active one, else at
 *  the end). The context menu passes the right-clicked page; the titlebar "+"
 *  omits it and falls back to the active slide. Returns the new page's id. */
export function addPage(view: EditorView, afterId?: string): string {
  const { state } = view;
  const pages = pageList(state.doc);
  const after =
    (afterId != null ? pages.find((p) => p.id === afterId) : undefined) ??
    pages.find((p) => p.id === getActivePageId(state)) ??
    pages[pages.length - 1];
  const node = createPageNode(state.schema);
  const id = node.attrs["id"] as string;
  const insertAt = after ? after.pos + after.node.nodeSize : state.doc.content.size;
  commitWithActive(view, state.tr.insert(insertAt, node), id);
  return id;
}

/** Duplicate a slide directly after itself. Returns the copy's id (or the
 *  original id if the slide wasn't found, so a caller's selection stays sane). */
export function duplicatePage(view: EditorView, id: string): string {
  const { state } = view;
  const entry = pageList(state.doc).find((p) => p.id === id);
  if (!entry) return id;
  const copyId = newPageId();
  const copy = entry.node.type.create(
    { ...entry.node.attrs, id: copyId, title: `${entry.title} copy` },
    entry.node.content,
    entry.node.marks,
  );
  const insertAt = entry.pos + entry.node.nodeSize;
  commitWithActive(view, state.tr.insert(insertAt, copy), copyId);
  return copyId;
}

/** Delete a slide (guarded so the deck always keeps one). Activates the
 *  previous slide, else the next. Returns the activated neighbor's id, or null
 *  when nothing was deleted. */
export function deletePage(view: EditorView, id: string): string | null {
  const { state } = view;
  const pages = pageList(state.doc);
  if (pages.length <= 1) return null;
  const idx = pages.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  const entry = pages[idx]!;
  const neighbor = pages[idx - 1] ?? pages[idx + 1]!;
  const tr = state.tr.delete(entry.pos, entry.pos + entry.node.nodeSize);
  commitWithActive(view, tr, neighbor.id);
  return neighbor.id;
}

/** Rename a slide. A blank/whitespace title falls back to "Untitled". Edits
 *  only the page node's `title` attr (so content + active slide are untouched)
 *  and never steals focus from the rail's rename input. No-op when the title is
 *  unchanged. Returns the id, for selection symmetry with the other ops. */
export function renamePage(view: EditorView, id: string, title: string): string {
  const { state } = view;
  const entry = pageList(state.doc).find((p) => p.id === id);
  if (!entry) return id;
  const next = title.trim() || "Untitled";
  if (next === entry.title) return id;
  view.dispatch(
    state.tr.setNodeMarkup(entry.pos, undefined, { ...entry.node.attrs, title: next }),
  );
  return id;
}

/** Reorder: move slide `fromId` to sit before slide `beforeId` (or to the
 *  end when `beforeId` is null). The moved slide stays active. */
export function movePage(view: EditorView, fromId: string, beforeId: string | null): void {
  if (fromId === beforeId) return;
  const { state } = view;
  const from = pageList(state.doc).find((p) => p.id === fromId);
  if (!from) return;
  let tr = state.tr.delete(from.pos, from.pos + from.node.nodeSize);
  const remaining = pageList(tr.doc);
  const before = beforeId != null ? remaining.find((p) => p.id === beforeId) : null;
  // "To the end" means after the last page — NOT doc end, which can sit after a
  // global footer (`header? page+ footer?`).
  const last = remaining[remaining.length - 1];
  const insertAt = before
    ? before.pos
    : last
      ? last.pos + last.node.nodeSize
      : tr.doc.content.size;
  tr = tr.insert(insertAt, from.node);
  commitWithActive(view, tr, fromId);
}

/** Move a slide to the very beginning of the deck (no-op if already first). */
export function movePageToStart(view: EditorView, id: string): void {
  const first = pageList(view.state.doc)[0];
  if (!first || first.id === id) return;
  movePage(view, id, first.id);
}

/** Move a slide to the very end of the deck (no-op if already last). */
export function movePageToEnd(view: EditorView, id: string): void {
  const pages = pageList(view.state.doc);
  if (pages[pages.length - 1]?.id === id) return;
  movePage(view, id, null);
}

// ────────────────────────────────────────────────────────────────
// Transitions — the entry animation each page plays when viewing the
// site (see transitions.ts; played by runtime/SiteRenderer). Pure attr
// edits: they don't move the cursor or change the active page, so they
// dispatch directly (like renamePage) rather than via commitWithActive.
// ────────────────────────────────────────────────────────────────

/** Set one page's entry transition + Effect Option + speed. No-op when gone. */
export function setPageTransition(
  view: EditorView,
  id: string,
  transition: TransitionType,
  variant: string,
  speed: TransitionSpeed,
): void {
  const { state } = view;
  const entry = pageList(state.doc).find((p) => p.id === id);
  if (!entry) return;
  view.dispatch(
    state.tr.setNodeMarkup(entry.pos, undefined, {
      ...entry.node.attrs,
      transition,
      transitionVariant: variant,
      transitionSpeed: speed,
    }),
  );
}

/** "Apply to all pages" — stamp the same transition + Effect Option + speed
 *  onto every page in one transaction. setNodeMarkup leaves node sizes
 *  unchanged, so the positions stay valid across the loop. */
export function setAllPagesTransition(
  view: EditorView,
  transition: TransitionType,
  variant: string,
  speed: TransitionSpeed,
): void {
  const { state } = view;
  const pages = pageList(state.doc);
  if (pages.length === 0) return;
  let tr = state.tr;
  for (const entry of pages) {
    tr = tr.setNodeMarkup(entry.pos, undefined, {
      ...entry.node.attrs,
      transition,
      transitionVariant: variant,
      transitionSpeed: speed,
    });
  }
  view.dispatch(tr);
}

// ────────────────────────────────────────────────────────────────
// Section ⇄ page operations: split one page's sections into pages,
// and the inverse — merge several pages' sections onto one page.
// ────────────────────────────────────────────────────────────────

/** A page splits into its optional `header`, its `section` body, and its
 *  optional `footer` — the page content model (`header? section+ footer?`). */
function splitPageChildren(page: PmNode): {
  header: PmNode | null;
  sections: PmNode[];
  footer: PmNode | null;
} {
  let header: PmNode | null = null;
  let footer: PmNode | null = null;
  const sections: PmNode[] = [];
  page.forEach((child) => {
    if (child.type.name === "header") header = child;
    else if (child.type.name === "footer") footer = child;
    else sections.push(child);
  });
  return { header, sections, footer };
}

/** Explode a page into one page per section: a page with N sections becomes N
 *  pages, each holding one section. The first keeps the original id + title (so
 *  the active page stays valid); the rest get fresh ids and numbered titles. A
 *  header/footer bookends the sequence — header on the first page, footer on the
 *  last. No-op (returns []) when the page has fewer than two sections. Returns
 *  the resulting page ids in order so the caller can select them. */
export function splitPageSections(view: EditorView, id: string): string[] {
  const { state } = view;
  const entry = pageList(state.doc).find((p) => p.id === id);
  if (!entry) return [];
  const { header, sections, footer } = splitPageChildren(entry.node);
  if (sections.length < 2) return [];
  const ids: string[] = [];
  const pages = sections.map((section, i) => {
    const pid = i === 0 ? entry.id : newPageId();
    ids.push(pid);
    const title = i === 0 ? entry.title : `${entry.title} ${i + 1}`;
    const content: PmNode[] = [];
    if (i === 0 && header) content.push(header);
    content.push(section);
    if (i === sections.length - 1 && footer) content.push(footer);
    return entry.node.type.create({ ...entry.node.attrs, id: pid, title }, content);
  });
  const tr = state.tr.replaceWith(entry.pos, entry.pos + entry.node.nodeSize, pages);
  commitWithActive(view, tr, ids[0]!);
  return ids;
}

/** Merge several pages into one: all their sections, in document order, land on
 *  a single page that keeps the first selected page's id + title and sits in its
 *  slot; the others are removed. The merged page keeps the first page's header
 *  and the last page's footer (one of each is all the content model allows).
 *  No-op (returns null) for fewer than two pages. Returns the surviving id. */
export function mergePages(view: EditorView, ids: string[]): string | null {
  const { state } = view;
  const set = new Set(ids);
  const selected = pageList(state.doc).filter((p) => set.has(p.id)); // doc order
  if (selected.length < 2) return null;
  const first = selected[0]!;
  const sections: PmNode[] = [];
  let header: PmNode | null = null;
  let footer: PmNode | null = null;
  selected.forEach((entry, idx) => {
    const parts = splitPageChildren(entry.node);
    if (idx === 0) header = parts.header;
    if (idx === selected.length - 1) footer = parts.footer;
    sections.push(...parts.sections);
  });
  const content: PmNode[] = [];
  if (header) content.push(header);
  content.push(...sections);
  if (footer) content.push(footer);
  const merged = first.node.type.create({ ...first.node.attrs }, content, first.node.marks);
  let tr = state.tr;
  // Delete bottom-up so each page's recorded position stays valid as we go;
  // after the last delete (the first page) its slot is where `merged` lands.
  for (let i = selected.length - 1; i >= 0; i--) {
    const entry = selected[i]!;
    tr = tr.delete(entry.pos, entry.pos + entry.node.nodeSize);
  }
  tr = tr.insert(first.pos, merged);
  commitWithActive(view, tr, first.id);
  return first.id;
}

/** Duplicate every selected page, inserting the copies (in order, with fresh
 *  ids) directly after the last selected page. Returns the new ids; the first
 *  copy becomes active. */
export function duplicatePages(view: EditorView, ids: string[]): string[] {
  const { state } = view;
  const set = new Set(ids);
  const selected = pageList(state.doc).filter((p) => set.has(p.id)); // doc order
  if (selected.length === 0) return [];
  const newIds: string[] = [];
  const copies = selected.map((entry) => {
    const pid = newPageId();
    newIds.push(pid);
    return entry.node.type.create(
      { ...entry.node.attrs, id: pid, title: `${entry.title} copy` },
      entry.node.content,
      entry.node.marks,
    );
  });
  const last = selected[selected.length - 1]!;
  const tr = state.tr.insert(last.pos + last.node.nodeSize, copies);
  commitWithActive(view, tr, newIds[0]!);
  return newIds;
}

/** Delete every selected page, guarded so the deck always keeps one (if the
 *  selection covers the whole deck the first page survives). Activates the
 *  surviving page just above the first deletion (else the first remaining).
 *  Returns that survivor's id. */
export function deletePages(view: EditorView, ids: string[]): string | null {
  const { state } = view;
  const pages = pageList(state.doc);
  const set = new Set(ids);
  let targets = pages.filter((p) => set.has(p.id)); // doc order
  if (targets.length === 0) return null;
  // Never empty the deck — keep the first page if every page was selected.
  if (targets.length >= pages.length) targets = targets.slice(1);
  if (targets.length === 0) return getActivePageId(state);
  const delSet = new Set(targets.map((t) => t.id));
  const remaining = pages.filter((p) => !delSet.has(p.id));
  const above = remaining.filter((p) => p.pos < targets[0]!.pos);
  const survivor = above[above.length - 1] ?? remaining[0]!;
  let tr = state.tr;
  for (let i = targets.length - 1; i >= 0; i--) {
    const entry = targets[i]!;
    tr = tr.delete(entry.pos, entry.pos + entry.node.nodeSize);
  }
  commitWithActive(view, tr, survivor.id);
  return survivor.id;
}
