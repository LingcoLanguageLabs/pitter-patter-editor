/**
 * Categorization — schema.
 *
 *   cat              — outer block (group "block"): the question. Gets shuffle
 *                      grid attrs / margin / section-containment for free
 *                      (inserted before those pipeline steps), like `mc`/`fb`.
 *     cat_prompt     — the question STEM (exactly one): a `block+` container
 *                      ("put anything" — paragraph by default, plus media), the
 *                      same stem MC/FB use.
 *     cat_category+  — each category bucket. Holds the items that BELONG to it
 *                      (the answer key is encoded by nesting). `cat_item*` so a
 *                      bucket can be emptied. The category's label is an attr
 *                      (`name`), edited via an <input> in the NodeView — keeping
 *                      the bucket's content purely draggable item cards.
 *       cat_item*    — an item card (rich inline). Shuffle-draggable so the
 *                      author drags it between buckets to set the grouping;
 *                      `containedBy: cat` lets it move between ANY bucket in this
 *                      question (but not escape the block).
 *
 * `isolating` keeps cursor/selection contained. Child nodes carry NO group, so
 * the shuffle-grid / margin / name / containment pipeline steps skip them — only
 * `cat` is a block. The answer key (`correct` category per item) is the parent
 * bucket, so it never leaves the block.
 */

import type { NodeSpec } from "prosemirror-model";

import {
  FEEDBACK_NODE_ATTRS,
  feedbackToDom,
  readFeedbackAttrs,
} from "../shared/scoring";

export const CAT_NODE = "cat";
export const CAT_PROMPT_NODE = "cat_prompt";
export const CAT_CATEGORY_NODE = "cat_category";
export const CAT_ITEM_NODE = "cat_item";

/** How the completer presents the task: drag cards into buckets ("grid") or
 *  pick a category per row with radios ("matrix"). Authoring is identical. */
export type CatDisplay = "grid" | "matrix";

export const catSpec: NodeSpec = {
  group: "block",
  content: `${CAT_PROMPT_NODE} ${CAT_CATEGORY_NODE}+ item_explanation`,
  defining: true,
  isolating: true,
  attrs: {
    /** Stable id for response keying / persistence. Stamped on construct. */
    itemId: { default: "" },
    /** Completer presentation: "grid" (drag-and-drop) | "matrix" (radios). */
    display: { default: "grid" as CatDisplay },
    /** Point value of the question (for scoring). */
    points: { default: 1 },
    // Author-customizable verdict messages (shared across gradable types).
    ...FEEDBACK_NODE_ATTRS,
  },
  parseDOM: [
    {
      tag: 'div[data-node-type="cat"]',
      getAttrs(dom) {
        if (!(dom instanceof HTMLElement)) return false;
        const points = dom.getAttribute("data-points");
        return {
          itemId: dom.getAttribute("data-item-id") || "",
          display:
            dom.getAttribute("data-display") === "matrix" ? "matrix" : "grid",
          points: points == null ? 1 : Number(points),
          ...readFeedbackAttrs(dom),
        };
      },
    },
  ],
  toDOM(node) {
    const a = node.attrs;
    const attrs: Record<string, string> = {
      "data-node-type": "cat",
      class: "pp-cat",
      ...feedbackToDom(a),
    };
    if (a["itemId"]) attrs["data-item-id"] = a["itemId"] as string;
    if (a["display"] === "matrix") attrs["data-display"] = "matrix";
    if (a["points"] !== 1) attrs["data-points"] = String(a["points"]);
    return ["div", attrs, 0];
  },
};

export const catPromptSpec: NodeSpec = {
  // Block container (the question stem) — holds any content blocks, defaults to
  // one paragraph. `block+` so it's never empty.
  content: "block+",
  defining: true,
  parseDOM: [{ tag: 'div[data-node-type="cat-prompt"]' }],
  toDOM: () => [
    "div",
    { "data-node-type": "cat-prompt", class: "pp-cat-prompt" },
    0,
  ],
};

export const catCategorySpec: NodeSpec = {
  // A bucket: zero or more item cards. The label is an attr (see `name`); the
  // content is only the draggable cards so shuffle reorder/move stays clean.
  content: `${CAT_ITEM_NODE}*`,
  defining: true,
  attrs: {
    /** Stable id — items reference this as their "correct" category. */
    categoryId: { default: "" },
    /** Display label for the bucket (editable inline via an <input>). */
    name: { default: "" },
  },
  parseDOM: [
    {
      tag: 'div[data-node-type="cat-category"]',
      getAttrs(dom) {
        if (!(dom instanceof HTMLElement)) return false;
        return {
          categoryId: dom.getAttribute("data-category-id") || "",
          name: dom.getAttribute("data-name") || "",
        };
      },
    },
  ],
  toDOM(node) {
    const a = node.attrs;
    const attrs: Record<string, string> = {
      "data-node-type": "cat-category",
      class: "pp-cat-category",
    };
    if (a["categoryId"]) attrs["data-category-id"] = a["categoryId"] as string;
    if (a["name"]) attrs["data-name"] = a["name"] as string;
    return ["div", attrs, 0];
  },
};

export const catItemSpec: NodeSpec = {
  content: "inline*",
  defining: true,
  // Shuffle-draggable for grouping. `containedBy: CAT_NODE` (the outer block,
  // NOT the immediate bucket) so an item can be dragged between any bucket in
  // this question while still being unable to escape the block — the same
  // mechanism MC options use, widened from one bucket to all of them.
  pitterPatter: {
    shuffle: { draggable: true, containedBy: CAT_NODE },
  },
  attrs: {
    /** Stable id for response keying — survives reorder / move / re-render. */
    cardId: { default: "" },
  },
  parseDOM: [
    {
      tag: 'div[data-node-type="cat-item"]',
      getAttrs(dom) {
        if (!(dom instanceof HTMLElement)) return false;
        return { cardId: dom.getAttribute("data-card-id") || "" };
      },
    },
  ],
  toDOM(node) {
    const a = node.attrs;
    const attrs: Record<string, string> = {
      "data-node-type": "cat-item",
      class: "pp-cat-item",
    };
    if (a["cardId"]) attrs["data-card-id"] = a["cardId"] as string;
    return ["div", attrs, 0];
  },
};
