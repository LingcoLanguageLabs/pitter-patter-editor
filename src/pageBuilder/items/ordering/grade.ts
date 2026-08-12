/**
 * Ordering — grading. `orderingPerItem` is the per-card "is it in its right
 * position?" map the completer uses to colour cards; `gradeOrdering` is the
 * scoring authority (verdict + aggregate scorer) over the same comparison.
 * All-or-nothing: full points only when the whole sequence matches.
 *
 * `response` is the canonical persisted shape — the card ids in the order the
 * student arranged them. The answer key is each card's index in `def.items`.
 */

import { correctnessResult } from "../shared/scoring";
import type { ItemGradeResult } from "../types";
import type { OrderingDef } from "./serialize";

/** Student response: the card ids in the order they arranged them. */
export type OrdResponse = string[];

/** card id → is it in its correct position? (presentation detail). */
export function orderingPerItem(
  def: OrderingDef,
  response: unknown,
): Record<string, boolean> {
  const order = Array.isArray(response) ? (response as string[]) : [];
  const correctIndex = new Map(def.items.map((it, i) => [it.id, i]));
  const perItem: Record<string, boolean> = {};
  order.forEach((cardId, position) => {
    perItem[cardId] = correctIndex.get(cardId) === position;
  });
  return perItem;
}

export function gradeOrdering(
  def: OrderingDef,
  response: unknown,
): ItemGradeResult {
  const perItem = orderingPerItem(def, response);
  const isCorrect =
    def.items.length > 0 && def.items.every((it) => perItem[it.id]);
  return correctnessResult(isCorrect, def.points);
}
