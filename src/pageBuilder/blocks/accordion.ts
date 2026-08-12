/**
 * Accordion — schema specs (kept here rather than inline in `schema.ts` to keep
 * the multi-node block cohesive; folded into the page-builder schema by
 * `addPageBuilderNodes`, BEFORE the shuffle/containment steps, so the outer
 * `accordion` (group "block") gets grid/margin/section-containment for free).
 *
 *   accordion        — outer block (group "block"): an `accordion_item+` list.
 *     accordion_item — one row: a header (the clickable title) + a panel (the
 *                      collapsible body). Shuffle-draggable, `containedBy:
 *                      accordion`, so the author reorders rows without it
 *                      escaping the block — the deck-of-cards pattern MC options /
 *                      categorization cards use.
 *       accordion_header — `inline*`, the title (rich text, edited inline).
 *       accordion_panel  — `block+`, the body ("put anything", like an item stem).
 *
 * Only `accordion` is group "block"; the children carry no group, so the shuffle
 * grid / margin / name pipeline steps skip them. The collapse behavior is runtime
 * only (the builder shows every panel open for editing).
 */

import type { NodeSpec } from "prosemirror-model";

export const ACCORDION_NODE = "accordion";
export const ACCORDION_ITEM_NODE = "accordion_item";
export const ACCORDION_HEADER_NODE = "accordion_header";
export const ACCORDION_PANEL_NODE = "accordion_panel";

export const accordionSpec: NodeSpec = {
  group: "block",
  content: `${ACCORDION_ITEM_NODE}+`,
  defining: true,
  isolating: true,
  attrs: {
    /** Allow several rows open at once (false = single-open, classic accordion). */
    allowMultiple: { default: false },
  },
  parseDOM: [
    {
      tag: 'div[data-node-type="accordion"]',
      getAttrs(dom) {
        if (!(dom instanceof HTMLElement)) return false;
        return { allowMultiple: dom.getAttribute("data-multiple") === "true" };
      },
    },
  ],
  toDOM(node) {
    const attrs: Record<string, string> = {
      "data-node-type": "accordion",
      class: "pb-accordion",
    };
    if (node.attrs["allowMultiple"]) attrs["data-multiple"] = "true";
    return ["div", attrs, 0];
  },
};

export const accordionItemSpec: NodeSpec = {
  content: `${ACCORDION_HEADER_NODE} ${ACCORDION_PANEL_NODE}`,
  defining: true,
  // Reorder within the accordion (and only there) — the same shuffle mechanism
  // MC options / categorization cards use: draggable + containedBy the block.
  pitterPatter: {
    shuffle: { draggable: true, containedBy: ACCORDION_NODE },
  },
  attrs: {
    /** Initial open state on the published site (and the builder's preview). */
    open: { default: false },
  },
  parseDOM: [
    {
      tag: 'div[data-node-type="accordion-item"]',
      getAttrs(dom) {
        if (!(dom instanceof HTMLElement)) return false;
        return { open: dom.getAttribute("data-open") === "true" };
      },
    },
  ],
  toDOM(node) {
    const attrs: Record<string, string> = {
      "data-node-type": "accordion-item",
      class: "pb-accordion-item",
    };
    if (node.attrs["open"]) attrs["data-open"] = "true";
    return ["div", attrs, 0];
  },
};

export const accordionHeaderSpec: NodeSpec = {
  content: "inline*",
  defining: true,
  parseDOM: [{ tag: 'div[data-node-type="accordion-header"]' }],
  toDOM: () => [
    "div",
    { "data-node-type": "accordion-header", class: "pb-accordion-header" },
    0,
  ],
};

export const accordionPanelSpec: NodeSpec = {
  content: "block+",
  defining: true,
  parseDOM: [{ tag: 'div[data-node-type="accordion-panel"]' }],
  toDOM: () => [
    "div",
    { "data-node-type": "accordion-panel", class: "pb-accordion-panel" },
    0,
  ],
};
