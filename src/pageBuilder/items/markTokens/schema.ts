/**
 * Mark the Words — schema. The click-the-words cousin of Fill Blanks: instead of
 * gaps the student types/drops into, the FULL sentence is shown and the student
 * clicks the words that answer the prompt (e.g. "click all the verbs").
 *
 *   mt           — outer block (group "block"): the question. Gets shuffle grid
 *                  attrs / margin / section-containment for free (inserted before
 *                  those pipeline steps), like `mc`/`fb`/`ord`.
 *     mt_prompt  — the question STEM (exactly one): a `block+` "put anything"
 *                  container (paragraph by default, plus media) — the SAME stem
 *                  MC/FB/Ordering use. Static; rendered via the shared walker.
 *     mt_text    — the markable text (exactly one): `paragraph+`. The author types
 *                  the sentence(s) here and marks the correct words with the
 *                  `mttoken` mark (the "Mark target" toolbar action). Every word
 *                  becomes clickable in the completer; marked words are the key.
 *
 *   mttoken      — a mark flagging a correct word. No attrs — its presence on a
 *                  word IS the answer. Only ever applied inside `mt_text` (the
 *                  "Mark target" action is gated there). Never reaches the runtime
 *                  walker — the completer serializes `mt_text` to tokens itself —
 *                  so it only styles the editor (highlighted answer key).
 *
 * `isolating` keeps cursor/selection contained. Child nodes carry NO group, so
 * the shuffle-grid / margin / name / containment pipeline steps skip them — only
 * `mt` is a block. The answer key (the marks) lives in `mt_text`, contained to
 * the block.
 */

import type { MarkSpec, NodeSpec } from "prosemirror-model";

import {
  FEEDBACK_NODE_ATTRS,
  feedbackToDom,
  readFeedbackAttrs,
} from "../shared/scoring";

export const MT_NODE = "mt";
export const MT_PROMPT_NODE = "mt_prompt";
export const MT_TEXT_NODE = "mt_text";
export const MTTOKEN_MARK = "mttoken";

export const mtSpec: NodeSpec = {
  group: "block",
  content: `${MT_PROMPT_NODE} ${MT_TEXT_NODE} item_explanation`,
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
      tag: 'div[data-node-type="mt"]',
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
      "data-node-type": "mt",
      class: "pp-mt",
      ...feedbackToDom(a),
    };
    if (a["itemId"]) attrs["data-item-id"] = a["itemId"] as string;
    if (a["points"] !== 1) attrs["data-points"] = String(a["points"]);
    return ["div", attrs, 0];
  },
};

export const mtPromptSpec: NodeSpec = {
  // Block container (the question stem) — holds any content blocks, defaults to
  // one paragraph. `block+` so it's never empty.
  content: "block+",
  defining: true,
  parseDOM: [{ tag: 'div[data-node-type="mt-prompt"]' }],
  toDOM: () => [
    "div",
    { "data-node-type": "mt-prompt", class: "pp-mt-prompt" },
    0,
  ],
};

export const mtTextSpec: NodeSpec = {
  // The markable text — plain text lines (paragraphs). `paragraph+` so it's never
  // empty and tokenizes predictably (no media to tokenize). The author marks the
  // correct words inside it with the `mttoken` mark.
  content: "paragraph+",
  defining: true,
  parseDOM: [{ tag: 'div[data-node-type="mt-text"]' }],
  toDOM: () => ["div", { "data-node-type": "mt-text", class: "pp-mt-text" }, 0],
};

export const mttokenSpec: MarkSpec = {
  // No attrs — the mark's presence on a word is the answer key. Not inclusive, so
  // typing past a marked word doesn't extend the mark onto the next word.
  inclusive: false,
  parseDOM: [{ tag: "span[data-mt-token]" }],
  toDOM: () => ["span", { class: "pp-mttoken", "data-mt-token": "true" }, 0],
};
