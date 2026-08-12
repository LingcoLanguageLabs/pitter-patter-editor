/**
 * Rating — completer (student-facing). Renders the prompt through the shared
 * block walker, then an interactive icon scale. Clicking a position persists the
 * chosen value to the grading store (keyed by `itemId`) so it survives page nav.
 * It's a survey (completion scoring): no right answer, so after a Check the
 * verdict is the neutral "Thanks for your answer!" — never green/red.
 */

import { useState } from "react";

import { ItemFeedback } from "../shared/Feedback";
import { useRenderBlocks } from "../shared/blockRenderer";
import { useItemGrading } from "../shared/grading";
import type { CompleterProps } from "../types";
import { gradeRating } from "./grade";
import { isCumulative, ratingGlyph } from "./icons";
import type { RatingDef } from "./serialize";

export function RatingCompleter({ def }: CompleterProps<RatingDef>) {
  const { itemId, scale, icon, lowLabel, highLabel, feedback } = def;
  const renderBlocks = useRenderBlocks();
  const { graded, initialResponse, persist } = useItemGrading(itemId);
  const [value, setValue] = useState<number>(() =>
    typeof initialResponse === "number" ? initialResponse : 0,
  );
  // Hover preview (cumulative styles fill up to the hovered icon).
  const [hover, setHover] = useState(0);

  const grade = graded ? gradeRating(def, value) : null;
  const cumulative = isCumulative(icon);
  const display = hover > 0 ? hover : value;

  const pick = (next: number) => {
    setValue(next);
    persist(next); // re-picking clears this prompt's graded flag (re-checkable)
  };

  const hasLabels = !!lowLabel || !!highLabel;

  return (
    <div className="pp-rating-completer">
      <div className="pp-rating-prompt-render">{renderBlocks(def.prompt)}</div>
      <div
        className="pp-rating-scale"
        data-icon={icon}
        role="radiogroup"
        aria-label="Rating"
        onMouseLeave={() => setHover(0)}
      >
        {Array.from({ length: scale }, (_, i) => {
          const position = i + 1;
          const on = cumulative ? display >= position : display === position;
          return (
            <button
              key={position}
              type="button"
              className="pp-rating-icon"
              role="radio"
              aria-checked={value === position}
              aria-label={`${position} of ${scale}`}
              data-on={on || undefined}
              data-selected={value === position || undefined}
              onMouseEnter={() => setHover(position)}
              onFocus={() => setHover(position)}
              onBlur={() => setHover(0)}
              onClick={() => pick(position)}
            >
              {ratingGlyph(icon, scale, i, on)}
            </button>
          );
        })}
      </div>
      {hasLabels && (
        <div className="pp-rating-labels" aria-hidden>
          <span>{lowLabel}</span>
          <span>{highLabel}</span>
        </div>
      )}
      {grade && (
        <ItemFeedback
          status={grade.status}
          feedback={feedback}
          explanation={def.explanation}
        />
      )}
    </div>
  );
}
