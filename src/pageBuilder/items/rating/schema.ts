/**
 * Rating — schema. A survey/opinion item: the student picks a value on an icon
 * scale (stars / hearts / emoji faces / numbers). There's no right answer, so it
 * always scores by "completion" (any pick earns full credit) — the same mode an
 * Opinion poll uses.
 *
 *   rating          — outer block (group "block"): the question. Gets shuffle
 *                     grid attrs / margin / section-containment for free (added
 *                     before those pipeline steps), like `mc`.
 *     rating_prompt — the question STEM (exactly one): a `block+` "put anything"
 *                     container (paragraph by default, plus media), the SAME stem
 *                     MC/FB use; rendered via the shared block walker.
 *
 * The scale itself is NOT child nodes — it's attr-configured (`scale` count +
 * `icon` style + optional end labels) and rendered by the completer (interactive)
 * and the builder node view (a static preview). Only `rating` is group "block";
 * the prompt carries no group, so the shuffle/margin/name steps skip it.
 */

import type { NodeSpec } from "prosemirror-model";

import {
  FEEDBACK_NODE_ATTRS,
  feedbackToDom,
  readFeedbackAttrs,
} from "../shared/scoring";

export const RATING_NODE = "rating";
export const RATING_PROMPT_NODE = "rating_prompt";

/** Icon scale style. star/heart fill cumulatively (1..value); emoji/number are
 *  single-select (one face/number is chosen). */
export type RatingIconStyle = "star" | "heart" | "emoji" | "number";

export const ratingSpec: NodeSpec = {
  group: "block",
  content: `${RATING_PROMPT_NODE} item_explanation`,
  defining: true,
  isolating: true,
  attrs: {
    /** Stable id for response keying / persistence. Stamped on construct. */
    itemId: { default: "" },
    /** Completion credit (no right answer). */
    points: { default: 1 },
    /** Number of icons on the scale. */
    scale: { default: 5 },
    /** Icon style: "star" | "heart" | "emoji" | "number". */
    icon: { default: "star" as RatingIconStyle },
    /** Optional labels under the low / high end of the scale. */
    lowLabel: { default: "" },
    highLabel: { default: "" },
    // Author-customizable verdict message (shared with the other gradable types;
    // a rating only ever shows the "completion" message).
    ...FEEDBACK_NODE_ATTRS,
  },
  parseDOM: [
    {
      tag: 'div[data-node-type="rating"]',
      getAttrs(dom) {
        if (!(dom instanceof HTMLElement)) return false;
        const points = dom.getAttribute("data-points");
        const scale = dom.getAttribute("data-scale");
        return {
          itemId: dom.getAttribute("data-item-id") || "",
          points: points == null ? 1 : Number(points),
          scale: scale == null ? 5 : Number(scale),
          icon: (dom.getAttribute("data-icon") as RatingIconStyle) || "star",
          lowLabel: dom.getAttribute("data-low") || "",
          highLabel: dom.getAttribute("data-high") || "",
          ...readFeedbackAttrs(dom),
        };
      },
    },
  ],
  toDOM(node) {
    const a = node.attrs;
    const attrs: Record<string, string> = {
      "data-node-type": "rating",
      class: "pp-rating",
      ...feedbackToDom(a),
    };
    if (a["itemId"]) attrs["data-item-id"] = a["itemId"] as string;
    if (a["points"] !== 1) attrs["data-points"] = String(a["points"]);
    if (a["scale"] !== 5) attrs["data-scale"] = String(a["scale"]);
    if (a["icon"] && a["icon"] !== "star") attrs["data-icon"] = a["icon"] as string;
    if (a["lowLabel"]) attrs["data-low"] = a["lowLabel"] as string;
    if (a["highLabel"]) attrs["data-high"] = a["highLabel"] as string;
    return ["div", attrs, 0];
  },
};

export const ratingPromptSpec: NodeSpec = {
  // Block container (the question stem) — holds any content blocks, defaults to
  // one paragraph. `block+` so it's never empty.
  content: "block+",
  defining: true,
  parseDOM: [{ tag: 'div[data-node-type="rating-prompt"]' }],
  toDOM: () => [
    "div",
    { "data-node-type": "rating-prompt", class: "pp-rating-prompt" },
    0,
  ],
};
