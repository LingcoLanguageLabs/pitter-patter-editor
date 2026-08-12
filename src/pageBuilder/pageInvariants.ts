/**
 * Document-level structural invariants ProseMirror's content expressions
 * DECLARE but don't auto-enforce on edits.
 *
 * `page` is `header? section+ footer?`, so every page must keep at least one
 * section. But `tr.delete` (and position-based moves) will happily strip a
 * page's last section — leaving an invalid `header? footer?` page that renders
 * empty — because PM only re-fills required content for the operations that ask
 * it to (`createAndFill`, paste fitting), not for arbitrary deletes/moves. The
 * per-command guards (e.g. `SectionChromeWidget`'s delete) cover the obvious
 * path, but every other delete/move/drag path (`deleteBlocks`, the layers drag,
 * the context menu) would otherwise leak.
 *
 * So rather than guard each path, heal here: after any content-changing
 * transaction, any page left with zero sections gets a fresh empty section,
 * dropped between an optional header and footer. This is the same shape as the
 * common "always keep one trailing paragraph" ProseMirror plugin, lifted to the
 * page → section level. It can't loop: once every page has a section the next
 * append returns null.
 */

import { Plugin } from "prosemirror-state";
import type { Node as PmNode } from "prosemirror-model";

import { isItemType } from "./items/registry";

export function ensurePageSectionsPlugin() {
  return new Plugin({
    appendTransaction(trs, _oldState, newState) {
      if (!trs.some((tr) => tr.docChanged)) return null;
      const sectionType = newState.schema.nodes["section"];
      if (!sectionType) return null;

      // Collect the insert position for every sectionless page (computed on the
      // settled doc; applied high-to-low so earlier positions stay valid).
      const inserts: number[] = [];
      newState.doc.forEach((node, offset) => {
        if (node.type.name !== "page") return;
        let hasSection = false;
        node.forEach((child) => {
          if (child.type.name === "section") hasSection = true;
        });
        if (hasSection) return;
        // Land the section after a leading header (so it stays before any
        // trailing footer); else at the page's content start.
        const pageStart = offset + 1;
        const first = node.firstChild;
        inserts.push(
          first && first.type.name === "header"
            ? pageStart + first.nodeSize
            : pageStart,
        );
      });
      if (inserts.length === 0) return null;

      const tr = newState.tr;
      for (let i = inserts.length - 1; i >= 0; i--) {
        const section = sectionType.createAndFill();
        if (section) tr.insert(inserts[i]!, section);
      }
      return tr.docChanged ? tr : null;
    },
  });
}

/**
 * Keeps learning-item questions (Multiple Choice, Rating, …) OUT of the
 * header/footer bars: they only make sense in a page SECTION (or a descendant of
 * one — a card/row inside a section is fine), never in the chrome that wraps
 * every page. A question in a bar can't be graded either — `SiteRenderer`'s
 * grading map only walks page sections — so it'd be silently inert.
 *
 * This can't be a schema `content` rule: the same `container`/`card`/`row` nodes
 * live in BOTH sections (questions allowed) and bars (not), and content
 * expressions are local — they can't depend on an ancestor. So it's an
 * ancestor-aware transaction filter instead.
 *
 * It rejects only transactions that INCREASE the count of items nested in bars
 * (not "any bar has an item"), so a doc that somehow already contains one never
 * freezes the editor — only adding another is blocked. Pairs with the
 * header/footer picker hiding the Questions group (clean UX; this is the net for
 * drag / paste / nested inserts). Walks only the bar subtrees, so it's cheap.
 */
function countItemsInBars(doc: PmNode): number {
  let count = 0;
  const countInBar = (bar: PmNode) => {
    bar.descendants((d) => {
      if (isItemType(d.type.name)) count += 1;
    });
  };
  // Bars appear as doc-level masters and as per-page overrides — both are
  // direct children of `doc` or of a `page`, so no deep walk is needed.
  doc.forEach((top) => {
    if (top.type.name === "header" || top.type.name === "footer") {
      countInBar(top);
    } else if (top.type.name === "page") {
      top.forEach((child) => {
        if (child.type.name === "header" || child.type.name === "footer") {
          countInBar(child);
        }
      });
    }
  });
  return count;
}

export function restrictBarItemsPlugin() {
  return new Plugin({
    filterTransaction(tr, state) {
      if (!tr.docChanged) return true;
      // Allow anything that doesn't add a new question to a bar (moving one out,
      // or leaving a pre-existing one untouched, both keep the count ≤ before).
      return countItemsInBars(tr.doc) <= countItemsInBars(state.doc);
    },
  });
}
