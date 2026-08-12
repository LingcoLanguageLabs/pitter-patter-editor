/**
 * Rating — grading. A survey item: completion only (no right answer). Any chosen
 * value earns full credit; an unanswered rating is incomplete. `response` is the
 * persisted value — the chosen number (1..scale) — or undefined.
 */

import { completionResult } from "../shared/scoring";
import type { ItemGradeResult } from "../types";
import type { RatingDef } from "./serialize";

export function gradeRating(def: RatingDef, response: unknown): ItemGradeResult {
  const answered = typeof response === "number" && response >= 1;
  return completionResult(answered, def.points);
}
