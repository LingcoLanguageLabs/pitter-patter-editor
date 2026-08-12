/**
 * Multiple Choice — schema.
 *
 *   mc            — outer block (group "block"): the question. Gets shuffle
 *                   grid attrs / margin / section-containment for free because
 *                   it's inserted into the schema before those pipeline steps.
 *     mc_prompt   — the question STEM (exactly one): a block container
 *                   (`block+`) holding any content blocks — a paragraph by
 *                   default, but images / audio / video / headings / lists can
 *                   be added or it can be replaced. This is the "put anything"
 *                   stem; it renders via the shared block walker.
 *     mc_option+  — each answer option (rich inline), with `correct` (the
 *                   answer key, contained to the block) + a stable `optionId`.
 *
 * `isolating` keeps the cursor/selection inside the block so authoring (and the
 * student's answers) stay contained. Child nodes have NO group, so the shuffle
 * / margin / name / containment pipeline steps skip them — only `mc` is a block.
 *
 * Visual classes are applied by the NodeViews (editor) and the completer
 * (runtime); `toDOM`/`parseDOM` here just need to round-trip copy/paste.
 */

import type { NodeSpec } from "prosemirror-model";

import {
  FEEDBACK_NODE_ATTRS,
  feedbackToDom,
  readFeedbackAttrs,
} from "../shared/scoring";

export const MC_NODE = "mc";
export const MC_PROMPT_NODE = "mc_prompt";
export const MC_OPTION_NODE = "mc_option";

export const mcSpec: NodeSpec = {
  group: "block",
  content: `${MC_PROMPT_NODE} ${MC_OPTION_NODE}+ item_explanation`,
  defining: true,
  isolating: true,
  attrs: {
    /** Stable id for response keying / persistence. Stamped on construct. */
    itemId: { default: "" },
    /** false = single answer (radio), true = multiple answers (checkbox). */
    multiple: { default: false },
    /** Point value of the question (for scoring). */
    points: { default: 1 },
    /** How the question earns its points: "correctness" (default — graded
     *  against the option answer key) or "completion" (any non-empty response
     *  earns full credit; an opinion poll with no right answer). */
    scoringMode: { default: "correctness" },
    /** Option layout: "list" (the default vertical radio/checkbox list) or
     *  "grid" (image-forward cards in a responsive grid — each option's `image`
     *  backs a card with its text overlaid; selection toggles the card). */
    layout: { default: "list" as "list" | "grid" },
    // Author-customizable verdict messages (shared across gradable types).
    ...FEEDBACK_NODE_ATTRS,
  },
  parseDOM: [
    {
      tag: 'div[data-node-type="mc"]',
      getAttrs(dom) {
        if (!(dom instanceof HTMLElement)) return false;
        const points = dom.getAttribute("data-points");
        return {
          itemId: dom.getAttribute("data-item-id") || "",
          multiple: dom.getAttribute("data-multiple") === "true",
          points: points == null ? 1 : Number(points),
          scoringMode:
            dom.getAttribute("data-scoring") === "completion"
              ? "completion"
              : "correctness",
          layout: dom.getAttribute("data-layout") === "grid" ? "grid" : "list",
          ...readFeedbackAttrs(dom),
        };
      },
    },
  ],
  toDOM(node) {
    const a = node.attrs;
    const attrs: Record<string, string> = {
      "data-node-type": "mc",
      class: "pp-mc",
      ...feedbackToDom(a),
    };
    if (a["itemId"]) attrs["data-item-id"] = a["itemId"] as string;
    if (a["multiple"]) attrs["data-multiple"] = "true";
    if (a["points"] !== 1) attrs["data-points"] = String(a["points"]);
    // Only the non-default mode round-trips, keeping clean docs unchanged.
    if (a["scoringMode"] === "completion") attrs["data-scoring"] = "completion";
    if (a["layout"] === "grid") attrs["data-layout"] = "grid";
    return ["div", attrs, 0];
  },
};

export const mcPromptSpec: NodeSpec = {
  // Block container (the question stem) — holds any content blocks, defaults to
  // one paragraph. `block+` so it's never empty.
  content: "block+",
  defining: true,
  parseDOM: [{ tag: 'div[data-node-type="mc-prompt"]' }],
  toDOM: () => ["div", { "data-node-type": "mc-prompt", class: "pp-mc-prompt" }, 0],
};

export const mcOptionSpec: NodeSpec = {
  content: "inline*",
  defining: true,
  // Shuffle-draggable for reordering, gated to its own `mc` block — the same
  // mechanism as the shuffle docs' deck-of-cards (card: draggable + containedBy
  // "card_deck"). No shuffle grid attrs, so options reorder as a plain vertical
  // list (no column resize); `containedBy` makes `reorder` reject drops outside
  // this block and `autogroup`/`reposition` no-op. The prompt isn't draggable,
  // so it stays put as the first child.
  pitterPatter: {
    shuffle: { draggable: true, containedBy: MC_NODE },
  },
  attrs: {
    /** Stable id for response keying — survives reorder / add / remove. */
    optionId: { default: "" },
    /** Answer key: is this option a correct choice? */
    correct: { default: false },
    /** Optional image URL — backs the card in the "grid" layout (ignored by the
     *  list layout). */
    image: { default: "" },
  },
  parseDOM: [
    {
      tag: 'div[data-node-type="mc-option"]',
      getAttrs(dom) {
        if (!(dom instanceof HTMLElement)) return false;
        return {
          optionId: dom.getAttribute("data-option-id") || "",
          correct: dom.getAttribute("data-correct") === "true",
          image: dom.getAttribute("data-image") || "",
        };
      },
    },
  ],
  toDOM(node) {
    const a = node.attrs;
    const attrs: Record<string, string> = {
      "data-node-type": "mc-option",
      class: "pp-mc-option",
      "data-correct": String(!!a["correct"]),
    };
    if (a["optionId"]) attrs["data-option-id"] = a["optionId"] as string;
    if (a["image"]) attrs["data-image"] = a["image"] as string;
    return ["div", attrs, 0];
  },
};
