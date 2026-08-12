/**
 * Categorization — grading. `categorizationPerItem` is the per-card correctness
 * map the completer uses to colour cards; `gradeCategorization` is the scoring
 * authority (the completer's verdict + the aggregate scorer both call it) and
 * reuses the same per-card comparison, so there's one notion of "correct".
 * All-or-nothing: full points only when every card is in its right bucket.
 */

import { correctnessResult } from "../shared/scoring";
import type { ItemGradeResult } from "../types";
import type { CategorizationDef } from "./serialize";

/** Student response: card id → the category id they placed it in. A card with
 *  no entry (or the "unplaced" pool) is not yet answered. */
export type CatPlacement = Record<string, string>;

/** Sentinel category id for the unplaced pool in grid mode. */
export const POOL_ID = "__pool__";

/** card id → was it placed in the correct bucket? (presentation detail). */
export function categorizationPerItem(
  def: CategorizationDef,
  placement: CatPlacement,
): Record<string, boolean> {
  const perItem: Record<string, boolean> = {};
  for (const item of def.items) {
    perItem[item.id] = placement[item.id] === item.correctCategoryId;
  }
  return perItem;
}

export function gradeCategorization(
  def: CategorizationDef,
  response: unknown,
): ItemGradeResult {
  const placement = (response as CatPlacement) ?? {};
  const perItem = categorizationPerItem(def, placement);
  const isCorrect =
    def.items.length > 0 && def.items.every((item) => perItem[item.id]);
  return correctnessResult(isCorrect, def.points);
}
