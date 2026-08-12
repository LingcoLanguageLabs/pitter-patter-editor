/**
 * Shared prompt-level feedback — the ONE feedback block every gradable completer
 * renders once graded, and the ONE settings section every gradable type's
 * SettingsForm includes.
 *
 *   • <ItemFeedback>  — the graded feedback block: an optional type summary line,
 *     the verdict (green/red for correctness, neutral for completion; text from
 *     the author's custom message via `resolveFeedback`), the authored
 *     explanation (the `item_explanation` node's rich content), and a Try-again
 *     button for a wrong correctness answer.
 *   • <FeedbackFields> — the author's verdict-message editor. Shows correct +
 *     incorrect for correctness items, or the single response message when the
 *     item is in completion mode.
 *
 * Per-element styling (which option/card/blank is right) stays type-specific —
 * only this prompt-level block + its customization are shared.
 */

import type { Node as PmNode } from "prosemirror-model";
import type { ReactNode } from "react";

import { Field } from "./controls";
import { renderInline } from "./renderInline";
import { resolveFeedback, type FeedbackMessages } from "./scoring";
import type { JsonNode } from "../../runtime/shuffleLayout";
import type { ItemGradeResult, ScoringMode } from "../types";

import "./feedback.css";

/**
 * The shared prompt-level feedback block, rendered by every gradable completer
 * once graded. Three parts, all driven by the grade result + authored content:
 *   • verdict   — the customizable message for the outcome (green/red for
 *                 correctness, neutral for completion).
 *   • explanation — the authored "here's why" rationale (the `item_explanation`
 *                 node's rich inline content); empty renders nothing.
 *   • try again — re-attempt (un-grades) for a wrong correctness answer.
 * `summary` is an optional type-specific line above the verdict (e.g. an
 * estimate's "≈ 11% is ice", a categorization's "3 of 4 correct").
 */
export function ItemFeedback({
  status,
  feedback,
  explanation,
  summary,
  onTryAgain,
}: {
  status: ItemGradeResult["status"];
  feedback: FeedbackMessages;
  explanation?: JsonNode[];
  summary?: ReactNode;
  onTryAgain?: () => void;
}) {
  const completion = status === "complete" || status === "incomplete";
  const hasExplanation = (explanation?.length ?? 0) > 0;
  // Offer a retry on a wrong correctness answer (not when correct or completion).
  const showTryAgain = !!onTryAgain && status === "incorrect";
  return (
    <div className="pp-item-feedback" data-status={status}>
      {summary && <div className="pp-item-feedback-summary">{summary}</div>}
      <div
        className="pp-item-verdict"
        data-status={status}
        // Correctness drives the green/red; completion stays neutral.
        data-correct={completion ? undefined : status === "correct"}
      >
        {resolveFeedback(status, feedback)}
      </div>
      {hasExplanation && (
        <div className="pp-item-feedback-explanation">
          {renderInline(explanation)}
        </div>
      )}
      {showTryAgain && (
        <button
          type="button"
          className="pp-item-tryagain"
          onClick={onTryAgain}
        >
          Try again
        </button>
      )}
    </div>
  );
}

/** Author-customizable verdict messages for a gradable item's settings panel.
 *  Mode-aware: correctness items edit correct + incorrect; a completion item
 *  edits the single "response received" message. */
export function FeedbackFields({
  node,
  setAttr,
  scoringMode = "correctness",
}: {
  node: PmNode;
  setAttr: (name: string, value: unknown) => void;
  scoringMode?: ScoringMode;
}) {
  if (scoringMode === "completion") {
    return (
      <Field label="Response message">
        <input
          type="text"
          className="pb-text-input"
          placeholder="Thanks for your answer!"
          value={(node.attrs["feedbackComplete"] as string) ?? ""}
          onChange={(e) => setAttr("feedbackComplete", e.target.value)}
        />
      </Field>
    );
  }
  return (
    <>
      <Field label="Correct feedback">
        <input
          type="text"
          className="pb-text-input"
          placeholder="Correct!"
          value={(node.attrs["feedbackCorrect"] as string) ?? ""}
          onChange={(e) => setAttr("feedbackCorrect", e.target.value)}
        />
      </Field>
      <Field label="Incorrect feedback">
        <input
          type="text"
          className="pb-text-input"
          placeholder="Not quite"
          value={(node.attrs["feedbackIncorrect"] as string) ?? ""}
          onChange={(e) => setAttr("feedbackIncorrect", e.target.value)}
        />
      </Field>
    </>
  );
}
