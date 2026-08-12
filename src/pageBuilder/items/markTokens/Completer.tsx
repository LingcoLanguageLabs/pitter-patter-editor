/**
 * Mark the Words — completer (student-facing). Renders the prompt stem through
 * the shared block walker (media/paragraphs render normally), then the markable
 * text as lines of clickable word tokens. Clicking toggles a word in/out of the
 * response set. No own Check button — an official Check button grades it via the
 * shared grading store (`useItemGrading`): the response (the clicked token ids)
 * is persisted by `itemId` so it survives page nav; feedback shows when the store
 * has graded this prompt, and clicking again clears it (re-checkable).
 */

import { Fragment, useMemo, useState } from "react";

import { ItemFeedback } from "../shared/Feedback";
import { useRenderBlocks } from "../shared/blockRenderer";
import { useItemGrading } from "../shared/grading";
import type { CompleterProps } from "../types";
import {
  gradeMarkTokens,
  markTokensPerToken,
  type MtResponse,
  type MtTokenState,
} from "./grade";
import type { MarkTokensDef, MtToken } from "./serialize";

export function MarkTokensCompleter({ def }: CompleterProps<MarkTokensDef>) {
  const renderBlocks = useRenderBlocks();
  const { graded, initialResponse, persist, reset } = useItemGrading(def.itemId);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set((initialResponse as MtResponse) ?? []),
  );
  const perToken = useMemo(
    () => (graded ? markTokensPerToken(def, [...selected]) : null),
    [graded, def, selected],
  );
  const result = useMemo(
    () => (graded ? gradeMarkTokens(def, [...selected]) : null),
    [graded, def, selected],
  );

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      persist([...next]); // clicking persists, which clears the graded flag
      return next;
    });

  return (
    <div className="pp-mt-completer">
      {def.prompt.length > 0 && (
        <div className="pp-mt-completer-prompt">{renderBlocks(def.prompt)}</div>
      )}
      <div className="pp-mt-completer-text" data-graded={graded || undefined}>
        {def.lines.map((line, li) => (
          <p key={li} className="pp-mt-completer-line">
            {line.map((token, ti) => (
              <Fragment key={token.id}>
                <Token
                  token={token}
                  selected={selected.has(token.id)}
                  state={perToken?.[token.id]}
                  onToggle={() => toggle(token.id)}
                />
                {ti < line.length - 1 ? " " : null}
              </Fragment>
            ))}
          </p>
        ))}
      </div>
      {result && (
        <ItemFeedback
          status={result.status}
          feedback={def.feedback}
          explanation={def.explanation}
          onTryAgain={reset}
        />
      )}
    </div>
  );
}

function Token({
  token,
  selected,
  state,
  onToggle,
}: {
  token: MtToken;
  selected: boolean;
  state: MtTokenState | undefined;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="pp-mt-token"
      data-selected={selected || undefined}
      data-state={state}
      aria-pressed={selected}
      onClick={onToggle}
    >
      {token.text}
    </button>
  );
}
