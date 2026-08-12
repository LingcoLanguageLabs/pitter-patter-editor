/**
 * Multiple Choice — completer (student-facing). A standalone React component
 * over the typed `MultipleChoiceDef`: no ProseMirror. It NO LONGER owns a Check
 * button — grading is triggered by an official Check button (any scope) via the
 * shared grading store (`useItemGrading`). The selected option ids are persisted
 * to the store (keyed by `itemId`) so they survive page navigation; feedback
 * shows whenever the store has graded this prompt, and editing the selection
 * clears that feedback (the store un-grades on response change).
 *
 * MC needs no drag-and-drop; dnd-kit enters with Fill Blanks' word banks.
 */

import { useMemo, useState } from "react";

import { ItemFeedback } from "../shared/Feedback";
import { useRenderBlocks } from "../shared/blockRenderer";
import { useItemGrading } from "../shared/grading";
import { renderInline } from "../shared/renderInline";
import type { CompleterProps } from "../types";
import { gradeMultipleChoice } from "./grade";
import type { MultipleChoiceDef } from "./serialize";

type OptionState = "correct" | "incorrect" | "missed" | undefined;

function optionState(
  graded: boolean,
  completion: boolean,
  correct: boolean,
  selected: boolean,
): OptionState {
  // Completion (opinion) mode has no answer key — never color options.
  if (!graded || completion) return undefined;
  if (selected) return correct ? "correct" : "incorrect";
  return correct ? "missed" : undefined;
}

export function MultipleChoiceCompleter({
  def,
}: CompleterProps<MultipleChoiceDef>) {
  const { multiple, options, itemId, scoringMode, feedback, layout } = def;
  const completion = scoringMode === "completion";
  const grid = layout === "grid";
  const renderBlocks = useRenderBlocks();
  const { graded, initialResponse, persist, reset } = useItemGrading(itemId);
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set((initialResponse as string[]) ?? []),
  );

  const grade = useMemo(
    () => (graded ? gradeMultipleChoice(def, [...selected]) : null),
    [graded, def, selected],
  );

  // No lock after grading: editing the selection persists a new response, which
  // clears this prompt's graded flag (feedback) so it can be re-checked.
  const toggle = (optionId: string) => {
    setSelected((prev) => {
      const next = multiple ? new Set(prev) : new Set<string>();
      if (next.has(optionId)) next.delete(optionId);
      else next.add(optionId);
      persist(Array.from(next));
      return next;
    });
  };

  return (
    <div
      className="pp-mc-completer"
      data-multiple={multiple || undefined}
      data-checked={graded || undefined}
      data-layout={grid ? "grid" : undefined}
    >
      <div className="pp-mc-completer-prompt">{renderBlocks(def.prompt)}</div>
      <ul
        className="pp-mc-completer-options"
        role={multiple ? "group" : "radiogroup"}
      >
        {options.map((opt) => {
          const isSelected = selected.has(opt.optionId);
          const state = optionState(graded, completion, opt.correct, isSelected);
          return (
            <li key={opt.optionId}>
              <label
                className={grid ? "pp-mc-completer-card" : "pp-mc-completer-option"}
                data-state={state}
                data-selected={isSelected || undefined}
                style={
                  grid && opt.image
                    ? { backgroundImage: `url(${JSON.stringify(opt.image)})` }
                    : undefined
                }
              >
                <input
                  type={multiple ? "checkbox" : "radio"}
                  name={`mc-${itemId}`}
                  checked={isSelected}
                  onChange={() => toggle(opt.optionId)}
                />
                {grid ? (
                  <>
                    <span className="pp-mc-card-scrim" />
                    <span className="pp-mc-card-name">{renderInline(opt.content)}</span>
                    {isSelected && <span className="pp-mc-card-tick" aria-hidden>✓</span>}
                  </>
                ) : (
                  <span className="pp-mc-completer-option-text">
                    {renderInline(opt.content)}
                  </span>
                )}
              </label>
            </li>
          );
        })}
      </ul>
      {grade && (
        <ItemFeedback
          status={grade.status}
          feedback={feedback}
          explanation={def.explanation}
          onTryAgain={reset}
        />
      )}
    </div>
  );
}
