/**
 * Hotspot — grading. Correctness, all-or-nothing, in either mode:
 *   • "select" — the student taps visible regions; the clicked set must exactly
 *     equal the author's correct set (same rule as MC / Mark Tokens). Response is
 *     the array of clicked region ids.
 *   • "find"   — regions are hidden; the student clicks the image to locate the
 *     targets. Response is the array of click points. Correct iff every correct
 *     region has ≥1 click inside it AND no click lands outside all of them.
 * Pure, so a server grader can reuse it.
 */

import { correctnessResult } from "../shared/scoring";
import type { ItemGradeResult } from "../types";
import { regionContains, type HotspotRegion } from "./regions";
import { correctRegionIds, type HotspotDef } from "./serialize";

export type RegionState = "correct" | "missed" | "incorrect" | "neutral";

/** A click the student placed on the image (find mode), normalized 0..1. */
export interface FindPoint {
  x: number;
  y: number;
}

export function isFindPoints(resp: unknown): resp is FindPoint[] {
  return (
    Array.isArray(resp) &&
    resp.every(
      (p) => p && typeof p === "object" && typeof (p as FindPoint).x === "number",
    )
  );
}

/** select mode: per-region feedback (drives the region coloring). */
export function regionState(
  region: { id: string; correct: boolean },
  selected: ReadonlySet<string>,
): RegionState {
  const picked = selected.has(region.id);
  return region.correct
    ? picked
      ? "correct"
      : "missed"
    : picked
      ? "incorrect"
      : "neutral";
}

/** find mode: did any click land in this region? (drives the reveal coloring). */
export function regionFound(region: HotspotRegion, points: FindPoint[]): boolean {
  return points.some((p) => regionContains(region, p.x, p.y));
}

/** find mode: is a placed marker inside a correct region (a hit) or astray? */
export function markerHit(def: HotspotDef, p: FindPoint): boolean {
  return def.regions.some((r) => r.correct && regionContains(r, p.x, p.y));
}

export function gradeHotspot(def: HotspotDef, response: unknown): ItemGradeResult {
  if (def.mode === "find") {
    const pts = isFindPoints(response) ? response : [];
    const targets = def.regions.filter((r) => r.correct);
    const found = targets.filter((t) => pts.some((p) => regionContains(t, p.x, p.y)));
    const stray = pts.filter((p) => !markerHit(def, p));
    const isCorrect =
      targets.length > 0 && found.length === targets.length && stray.length === 0;
    return correctnessResult(isCorrect, def.points);
  }

  // select mode (default): clicked region set must equal the correct set.
  const selected = new Set(Array.isArray(response) ? (response as string[]) : []);
  const correct = correctRegionIds(def);
  const isCorrect =
    selected.size === correct.size && [...selected].every((id) => correct.has(id));
  return correctnessResult(isCorrect, def.points);
}
