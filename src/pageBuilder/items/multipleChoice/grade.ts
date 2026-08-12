/**
 * Multiple Choice — grading. The one scoring authority for MC; the completer's
 * verdict and the aggregate scorer both call it.
 *
 *   • "correctness" (default) — all-or-nothing: the selected set must exactly
 *     match the correct set.
 *   • "completion" — an opinion poll with no answer key: any non-empty selection
 *     earns full credit.
 *
 * `response` is the canonical persisted shape — the array of selected option
 * ids (what the completer writes to the grading store). Pure, so a server grader
 * can reuse it.
 */

import {
  completionResult,
  correctnessResult,
} from "../shared/scoring";
import type { ItemGradeResult } from "../types";
import type { MultipleChoiceDef } from "./serialize";

function correctOptionIds(def: MultipleChoiceDef): Set<string> {
  return new Set(def.options.filter((o) => o.correct).map((o) => o.optionId));
}

export function gradeMultipleChoice(
  def: MultipleChoiceDef,
  response: unknown,
): ItemGradeResult {
  const selected = new Set(
    Array.isArray(response) ? (response as string[]) : [],
  );

  // Opinion poll: any selection is full credit; the answer key is irrelevant.
  if (def.scoringMode === "completion") {
    return completionResult(selected.size > 0, def.points);
  }

  // Correctness: exact match against the answer key.
  const correctIds = correctOptionIds(def);
  const isCorrect =
    selected.size === correctIds.size &&
    [...selected].every((id) => correctIds.has(id));
  return correctnessResult(isCorrect, def.points);
}
