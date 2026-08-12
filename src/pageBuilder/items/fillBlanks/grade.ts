/**
 * Fill Blanks — grading. `isBlankCorrect` is the atomic per-blank comparison;
 * `fillBlanksPerBlank` maps it across all blanks (the completer colours blanks
 * with it); `gradeFillBlanks` is the scoring authority (verdict + aggregate
 * scorer) and reuses the same comparison. All-or-nothing overall.
 *
 * `response` is the canonical persisted shape — `Record<blankId, string>` (the
 * typed / selected / dropped answer text per blank). A blank is correct when its
 * value matches the primary answer OR any alternate, case-insensitively.
 */

import { correctnessResult } from "../shared/scoring";
import type { ItemGradeResult } from "../types";
import type { FbBlankDef, FillBlanksDef } from "./serialize";

export type FbResponse = Record<string, string>;

const norm = (s: string) => s.trim().toLowerCase();

export function isBlankCorrect(
  blank: FbBlankDef,
  value: string | undefined,
): boolean {
  if (!value) return false;
  const v = norm(value);
  if (v === norm(blank.answer)) return true;
  // Alternates are free-typed accepted answers — only meaningful for text
  // blanks (a dropdown's accepted answer is its marked option). Guarding here
  // means stale alternates left from a text→dropdown switch can't quietly
  // accept a distractor option.
  if (blank.mode !== "text") return false;
  return (blank.alternates ?? []).some((alt) => alt.trim() && norm(alt) === v);
}

/** blankId → is its value correct? (presentation detail). */
export function fillBlanksPerBlank(
  def: FillBlanksDef,
  response: unknown,
): Record<string, boolean> {
  const values = (response as FbResponse) ?? {};
  const perBlank: Record<string, boolean> = {};
  for (const b of def.blanks) {
    perBlank[b.blankId] = isBlankCorrect(b, values[b.blankId]);
  }
  return perBlank;
}

export function gradeFillBlanks(
  def: FillBlanksDef,
  response: unknown,
): ItemGradeResult {
  const perBlank = fillBlanksPerBlank(def, response);
  const isCorrect = def.blanks.every((b) => perBlank[b.blankId]);
  return correctnessResult(isCorrect, def.points);
}
