/**
 * Tabs — schema specs (sibling of `accordion.ts`). Folded into the page-builder
 * schema by `addPageBuilderNodes` before the shuffle steps, so the outer `tabs`
 * (group "block") gets grid/margin/section-containment for free.
 *
 *   tabs        — outer block (group "block"): a `tab+` list + an `active` index.
 *     tab       — one tab: a label + a panel. Shuffle-draggable, `containedBy:
 *                 tabs`, so the author reorders tabs (deck-of-cards pattern).
 *       tab_label — `inline*`, the clickable label (rich text, edited inline).
 *       tab_panel — `block+`, the panel body ("put anything").
 *
 * Only `tabs` is group "block"; children carry no group. The tab-switching is
 * runtime behavior (label strip + active panel). The builder shows the panels
 * stacked under their labels for editing (the established builder/runtime
 * divergence) — `active` seeds the runtime's initial tab.
 */

import type { NodeSpec } from "prosemirror-model";

export const TABS_NODE = "tabs";
export const TAB_NODE = "tab";
export const TAB_LABEL_NODE = "tab_label";
export const TAB_PANEL_NODE = "tab_panel";

export const tabsSpec: NodeSpec = {
  group: "block",
  content: `${TAB_NODE}+`,
  defining: true,
  isolating: true,
  attrs: {
    /** Index of the initially-active tab on the published site. */
    active: { default: 0 },
  },
  parseDOM: [
    {
      tag: 'div[data-node-type="tabs"]',
      getAttrs(dom) {
        if (!(dom instanceof HTMLElement)) return false;
        const active = dom.getAttribute("data-active");
        return { active: active == null ? 0 : Number(active) };
      },
    },
  ],
  toDOM(node) {
    const attrs: Record<string, string> = {
      "data-node-type": "tabs",
      class: "pb-tabs",
    };
    if (node.attrs["active"]) attrs["data-active"] = String(node.attrs["active"]);
    return ["div", attrs, 0];
  },
};

export const tabSpec: NodeSpec = {
  content: `${TAB_LABEL_NODE} ${TAB_PANEL_NODE}`,
  defining: true,
  pitterPatter: {
    shuffle: { draggable: true, containedBy: TABS_NODE },
  },
  parseDOM: [{ tag: 'div[data-node-type="tab"]' }],
  toDOM: () => ["div", { "data-node-type": "tab", class: "pb-tab" }, 0],
};

export const tabLabelSpec: NodeSpec = {
  content: "inline*",
  defining: true,
  parseDOM: [{ tag: 'div[data-node-type="tab-label"]' }],
  toDOM: () => [
    "div",
    { "data-node-type": "tab-label", class: "pb-tab-label" },
    0,
  ],
};

export const tabPanelSpec: NodeSpec = {
  content: "block+",
  defining: true,
  parseDOM: [{ tag: 'div[data-node-type="tab-panel"]' }],
  toDOM: () => [
    "div",
    { "data-node-type": "tab-panel", class: "pb-tab-panel" },
    0,
  ],
};
