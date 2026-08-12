/**
 * Ordering — schema. The 1-D cousin of Categorization: instead of sorting cards
 * into buckets, the student arranges a single list into the correct sequence.
 *
 *   ord            — outer block (group "block"): the question. Gets shuffle grid
 *                    attrs / margin / section-containment for free (inserted
 *                    before those pipeline steps), like `cat`/`mc`.
 *     ord_prompt   — the question STEM (exactly one): a `block+` container ("put
 *                    anything" — paragraph by default, plus media), the same stem
 *                    MC/FB/Categorization use.
 *     ord_item+    — each item card (rich inline). The DOCUMENT ORDER of these is
 *                    the answer key: the author writes them top-to-bottom in the
 *                    correct sequence (and can shuffle-drag to reorder). The
 *                    completer presents them shuffled for the student to sort.
 *                    Shuffle-draggable, `containedBy: ord` so a card reorders
 *                    within the list but can't escape the block.
 *
 * `isolating` keeps cursor/selection contained. Child nodes carry NO group, so
 * the shuffle-grid / margin / name / containment pipeline steps skip them — only
 * `ord` is a block. The answer key (the sequence) lives in the doc order, so it
 * never leaves the block — exactly like Categorization's nesting.
 */

import type { NodeSpec } from "prosemirror-model";

import {
  FEEDBACK_NODE_ATTRS,
  feedbackToDom,
  readFeedbackAttrs,
} from "../shared/scoring";

export const ORD_NODE = "ord";
export const ORD_PROMPT_NODE = "ord_prompt";
export const ORD_ITEM_NODE = "ord_item";

export const ordSpec: NodeSpec = {
  group: "block",
  content: `${ORD_PROMPT_NODE} ${ORD_ITEM_NODE}+ item_explanation`,
  defining: true,
  isolating: true,
  attrs: {
    /** Stable id for response keying / persistence. Stamped on construct. */
    itemId: { default: "" },
    /** Point value of the question (for scoring). */
    points: { default: 1 },
    // Author-customizable verdict messages (shared across gradable types).
    ...FEEDBACK_NODE_ATTRS,
  },
  parseDOM: [
    {
      tag: 'div[data-node-type="ord"]',
      getAttrs(dom) {
        if (!(dom instanceof HTMLElement)) return false;
        const points = dom.getAttribute("data-points");
        return {
          itemId: dom.getAttribute("data-item-id") || "",
          points: points == null ? 1 : Number(points),
          ...readFeedbackAttrs(dom),
        };
      },
    },
  ],
  toDOM(node) {
    const a = node.attrs;
    const attrs: Record<string, string> = {
      "data-node-type": "ord",
      class: "pp-ord",
      ...feedbackToDom(a),
    };
    if (a["itemId"]) attrs["data-item-id"] = a["itemId"] as string;
    if (a["points"] !== 1) attrs["data-points"] = String(a["points"]);
    return ["div", attrs, 0];
  },
};

export const ordPromptSpec: NodeSpec = {
  // Block container (the question stem) — holds any content blocks, defaults to
  // one paragraph. `block+` so it's never empty.
  content: "block+",
  defining: true,
  parseDOM: [{ tag: 'div[data-node-type="ord-prompt"]' }],
  toDOM: () => [
    "div",
    { "data-node-type": "ord-prompt", class: "pp-ord-prompt" },
    0,
  ],
};

export const ordItemSpec: NodeSpec = {
  content: "inline*",
  defining: true,
  // Shuffle-draggable for reordering. `containedBy: ORD_NODE` lets a card move
  // among the list's positions while being unable to escape the block — the same
  // mechanism MC options / Categorization items use.
  pitterPatter: {
    shuffle: { draggable: true, containedBy: ORD_NODE },
  },
  attrs: {
    /** Stable id for response keying — survives reorder / re-render. */
    cardId: { default: "" },
  },
  parseDOM: [
    {
      tag: 'div[data-node-type="ord-item"]',
      getAttrs(dom) {
        if (!(dom instanceof HTMLElement)) return false;
        return { cardId: dom.getAttribute("data-card-id") || "" };
      },
    },
  ],
  toDOM(node) {
    const a = node.attrs;
    const attrs: Record<string, string> = {
      "data-node-type": "ord-item",
      class: "pp-ord-item",
    };
    if (a["cardId"]) attrs["data-card-id"] = a["cardId"] as string;
    return ["div", attrs, 0];
  },
};
