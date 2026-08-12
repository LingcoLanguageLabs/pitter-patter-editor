/**
 * Fill Blanks — schema.
 *
 *   fb       — outer block (group "block"): the question, a `block+` container
 *              (same "put anything" stem as MC) whose paragraphs hold inline
 *              blanks. Gets shuffle grid attrs / margin / containment for free
 *              (added before the shuffle pipeline step).
 *
 *   blank    — an inline ATOM node marking a gap. Carries the choices and which
 *              one is correct. Allowed anywhere inline (group "inline"); only
 *              CREATED inside an `fb` (the "Mark as blank" action is gated
 *              there).
 *
 * A blank's choices live as `options: {id,text}[]` with `answerId` pointing at
 * the correct one. A "text" blank has a single option (typed answer); a
 * "dropdown" blank has the answer + distractors. Word-bank mode is a
 * question-level flag on `fb` (all blanks become drop zones).
 */

import type { NodeSpec } from "prosemirror-model";

import {
  FEEDBACK_NODE_ATTRS,
  feedbackToDom,
  readFeedbackAttrs,
} from "../shared/scoring";

export const FB_NODE = "fb";
export const BLANK_NODE = "blank";

export type BlankMode = "text" | "dropdown";
/** Where the word bank sits relative to the question (word-bank mode only). */
export type BankPosition = "top" | "bottom";
export interface BlankOption {
  id: string;
  text: string;
}

export const fbSpec: NodeSpec = {
  group: "block",
  content: "block+ item_explanation",
  defining: true,
  isolating: true,
  attrs: {
    itemId: { default: "" },
    points: { default: 1 },
    /** Question-level: all blanks become drag-drop zones fed by a shared bank. */
    wordBank: { default: false },
    /** Word-bank only: extra words shown in the bank that fit no blank. */
    bankDistractors: { default: [] as string[] },
    /** Word-bank only: bank above ("top", default) or below the question. */
    bankPosition: { default: "top" as BankPosition },
    // Author-customizable verdict messages (shared across gradable types).
    ...FEEDBACK_NODE_ATTRS,
  },
  parseDOM: [
    {
      tag: 'div[data-node-type="fb"]',
      getAttrs(dom) {
        if (!(dom instanceof HTMLElement)) return false;
        const points = dom.getAttribute("data-points");
        let bankDistractors: string[] = [];
        try {
          bankDistractors = JSON.parse(
            dom.getAttribute("data-distractors") || "[]",
          );
        } catch {
          bankDistractors = [];
        }
        return {
          itemId: dom.getAttribute("data-item-id") || "",
          points: points == null ? 1 : Number(points),
          wordBank: dom.getAttribute("data-word-bank") === "true",
          bankDistractors,
          bankPosition:
            dom.getAttribute("data-bank-position") === "bottom"
              ? "bottom"
              : "top",
          ...readFeedbackAttrs(dom),
        };
      },
    },
  ],
  toDOM(node) {
    const a = node.attrs;
    const distractors = (a["bankDistractors"] as string[]) ?? [];
    const attrs: Record<string, string> = {
      "data-node-type": "fb",
      class: "pp-fb",
      ...feedbackToDom(a),
    };
    if (a["itemId"]) attrs["data-item-id"] = a["itemId"] as string;
    if (a["points"] !== 1) attrs["data-points"] = String(a["points"]);
    if (a["wordBank"]) attrs["data-word-bank"] = "true";
    if (distractors.length)
      attrs["data-distractors"] = JSON.stringify(distractors);
    if (a["bankPosition"] === "bottom")
      attrs["data-bank-position"] = "bottom";
    return ["div", attrs, 0];
  },
};

export const blankSpec: NodeSpec = {
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,
  attrs: {
    blankId: { default: "" },
    /** "text" = typed answer; "dropdown" = pick from options. */
    mode: { default: "text" as BlankMode },
    /** All choices (one is the answer). For text mode there's just the answer. */
    options: { default: [] as BlankOption[] },
    /** Id of the correct option. */
    answerId: { default: "" },
    /** Additional accepted answers (text mode), matched case-insensitively
     *  alongside the primary answer. */
    alternates: { default: [] as string[] },
  },
  parseDOM: [
    {
      tag: 'span[data-node-type="blank"]',
      getAttrs(dom) {
        if (!(dom instanceof HTMLElement)) return false;
        let options: BlankOption[] = [];
        try {
          options = JSON.parse(dom.getAttribute("data-options") || "[]");
        } catch {
          options = [];
        }
        let alternates: string[] = [];
        try {
          alternates = JSON.parse(dom.getAttribute("data-alternates") || "[]");
        } catch {
          alternates = [];
        }
        return {
          blankId: dom.getAttribute("data-blank-id") || "",
          mode: (dom.getAttribute("data-mode") as BlankMode) || "text",
          options,
          answerId: dom.getAttribute("data-answer-id") || "",
          alternates,
        };
      },
    },
  ],
  toDOM(node) {
    const a = node.attrs;
    const options = (a["options"] as BlankOption[]) ?? [];
    const alternates = (a["alternates"] as string[]) ?? [];
    const answer = options.find((o) => o.id === a["answerId"])?.text ?? "";
    const attrs: Record<string, string> = {
      "data-node-type": "blank",
      class: "pp-blank",
      "data-blank-id": (a["blankId"] as string) || "",
      "data-mode": (a["mode"] as string) || "text",
      "data-answer-id": (a["answerId"] as string) || "",
      "data-options": JSON.stringify(options),
    };
    if (alternates.length)
      attrs["data-alternates"] = JSON.stringify(alternates);
    return [
      "span",
      attrs,
      // Text content is for clipboard / fallback only; the NodeView + runtime
      // render the interactive control.
      answer || "____",
    ];
  },
};
