/**
 * Mark the Words — grading. `markTokensPerToken` is the per-token feedback map
 * the completer uses to colour words; `gradeMarkTokens` is the scoring authority
 * (verdict + aggregate scorer) over the same target set. Like Multiple Choice
 * it's all-or-nothing: the clicked set must exactly match the target set.
 *
 * `response` is the canonical persisted shape — the array of clicked token ids.
 */

import { correctnessResult } from "../shared/scoring";
import type { ItemGradeResult } from "../types";
import { type MarkTokensDef, targetIds } from "./serialize";

/** The persisted response — the ids of the tokens the student clicked. */
export type MtResponse = string[];

/** Per-token feedback after grading. */
export type MtTokenState =
  | "correct" // a target the student clicked — right
  | "missed" // a target the student did NOT click — should have
  | "incorrect" // a non-target the student clicked — wrong
  | "neutral"; // a non-target left alone — fine

function toSelected(response: unknown): Set<string> {
  return new Set(Array.isArray(response) ? (response as string[]) : []);
}

/** token id → feedback state (presentation detail). */
export function markTokensPerToken(
  def: MarkTokensDef,
  response: unknown,
): Record<string, MtTokenState> {
  const selected = toSelected(response);
  const perToken: Record<string, MtTokenState> = {};
  for (const line of def.lines) {
    for (const t of line) {
      const picked = selected.has(t.id);
      perToken[t.id] = t.target
        ? picked
          ? "correct"
          : "missed"
        : picked
          ? "incorrect"
          : "neutral";
    }
  }
  return perToken;
}

export function gradeMarkTokens(
  def: MarkTokensDef,
  response: unknown,
): ItemGradeResult {
  const targets = targetIds(def);
  const selected = toSelected(response);
  const isCorrect =
    selected.size === targets.size &&
    [...selected].every((id) => targets.has(id));
  return correctnessResult(isCorrect, def.points);
}
