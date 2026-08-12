/**
 * Shared scoring + feedback — the ONE source of truth for how gradable items
 * turn a response into a result and a verdict. Pure (no React/DOM), so a server
 * grader can import it too.
 *
 *   • Result builders — the single way to construct an {@link ItemGradeResult}.
 *     Every type's `grade()` calls `correctnessResult` / `completionResult`
 *     rather than hand-rolling the object, so status/earned/possible stay
 *     consistent across types.
 *   • Feedback — author-customizable verdict messages ({@link FeedbackMessages}),
 *     stored as node attrs via {@link FEEDBACK_NODE_ATTRS} and resolved (custom
 *     else default) by {@link resolveFeedback}. One feedback model for all types.
 */

import type { ItemGradeResult } from "../types";

// ── Result builders (the only way to make an ItemGradeResult) ──────────

/** Correctness grading: full points iff the answer matches the key. */
export function correctnessResult(
  isCorrect: boolean,
  points: number,
): ItemGradeResult {
  return {
    status: isCorrect ? "correct" : "incorrect",
    earned: isCorrect ? points : 0,
    possible: points,
  };
}

/** Completion grading: full points for any genuine response (no answer key). */
export function completionResult(
  complete: boolean,
  points: number,
): ItemGradeResult {
  return {
    status: complete ? "complete" : "incomplete",
    earned: complete ? points : 0,
    possible: points,
  };
}

// ── Author-customizable feedback ───────────────────────────────────────

/** Verdict messages the author can override, keyed by outcome. An empty/absent
 *  field falls back to the built-in default for that outcome. */
export interface FeedbackMessages {
  correct: string;
  incorrect: string;
  complete: string;
}

export const DEFAULT_FEEDBACK: Record<ItemGradeResult["status"], string> = {
  correct: "Correct!",
  incorrect: "Not quite",
  complete: "Thanks for your answer!",
  incomplete: "Add a response first",
};

/** The verdict line for a graded result — the author's custom message for that
 *  outcome, else the default. `incomplete` shares the `complete` slot's intent
 *  (it's the completion track) but always uses the default nudge. */
export function resolveFeedback(
  status: ItemGradeResult["status"],
  feedback: FeedbackMessages,
): string {
  const custom =
    status === "correct"
      ? feedback.correct
      : status === "incorrect"
        ? feedback.incorrect
        : status === "complete"
          ? feedback.complete
          : ""; // incomplete → always the default nudge
  return custom.trim() || DEFAULT_FEEDBACK[status];
}

// ── Node-attr plumbing (so every gradable node stores feedback the same way) ──

/** Spread into a gradable item's outer-node `attrs`. */
export const FEEDBACK_NODE_ATTRS = {
  feedbackCorrect: { default: "" },
  feedbackIncorrect: { default: "" },
  feedbackComplete: { default: "" },
} as const;

/** toDOM data-attrs for feedback — only non-empty values round-trip, keeping
 *  untouched docs clean. Merge into the node's `toDOM` attrs object. */
export function feedbackToDom(
  attrs: Record<string, unknown>,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (attrs["feedbackCorrect"])
    out["data-feedback-correct"] = String(attrs["feedbackCorrect"]);
  if (attrs["feedbackIncorrect"])
    out["data-feedback-incorrect"] = String(attrs["feedbackIncorrect"]);
  if (attrs["feedbackComplete"])
    out["data-feedback-complete"] = String(attrs["feedbackComplete"]);
  return out;
}

/** parseDOM reader for feedback attrs. Merge into a node's `getAttrs` return. */
export function readFeedbackAttrs(dom: HTMLElement): Record<string, string> {
  return {
    feedbackCorrect: dom.getAttribute("data-feedback-correct") || "",
    feedbackIncorrect: dom.getAttribute("data-feedback-incorrect") || "",
    feedbackComplete: dom.getAttribute("data-feedback-complete") || "",
  };
}

/** Extract the {@link FeedbackMessages} from a node's attrs, for `serialize()`. */
export function serializeFeedback(
  attrs: Record<string, unknown> | undefined,
): FeedbackMessages {
  const a = attrs ?? {};
  return {
    correct: (a["feedbackCorrect"] as string) || "",
    incorrect: (a["feedbackIncorrect"] as string) || "",
    complete: (a["feedbackComplete"] as string) || "",
  };
}
