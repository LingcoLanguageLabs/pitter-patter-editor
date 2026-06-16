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
