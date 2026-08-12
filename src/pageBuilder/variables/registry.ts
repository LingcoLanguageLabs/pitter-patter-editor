/**
 * Variable registry — the ONE list of variables an author can reference in a
 * `{{ }}` token or a progress-bar expression. It drives three things from a
 * single source: the autocomplete menu, the sample values shown in the editor
 * (where there's no live learner/score), and documentation.
 *
 * Runtime values are assembled by {@link buildScope} from the grading score, the
 * deck position, and the learner profile. The dotted `name`s here are the exact
 * keys the expression engine looks up.
 */

import type { ActivityScore } from "../items/shared/grading";
import type { VariableScope } from "./expression";

export interface VariableDef {
  /** Dotted name the engine resolves, e.g. "score.earned". */
  name: string;
  /** Human label for the autocomplete row. */
  label: string;
  kind: "number" | "string";
  /** Value shown in the editor / thumbnails, where there's no live scope. */
  sample: string | number;
}

/** A learner profile — the source of `learner.*`. A real session fills this in;
 *  until auth exists we use {@link SAMPLE_LEARNER} so previews read naturally. */
export interface Learner {
  first_name: string;
  last_name: string;
}

export const SAMPLE_LEARNER: Learner = {
  first_name: "Seth",
  last_name: "Killian",
};

export const VARIABLE_DEFS: VariableDef[] = [
  { name: "learner.first_name", label: "Learner first name", kind: "string", sample: "Seth" },
  { name: "learner.last_name", label: "Learner last name", kind: "string", sample: "Killian" },
  { name: "score.earned", label: "Points earned", kind: "number", sample: 8 },
  { name: "score.possible", label: "Points possible", kind: "number", sample: 10 },
  { name: "score.percent", label: "Score percent", kind: "number", sample: 80 },
  { name: "score.correct", label: "Questions correct", kind: "number", sample: 4 },
  { name: "score.total", label: "Total questions", kind: "number", sample: 5 },
  { name: "page.number", label: "Current page", kind: "number", sample: 2 },
  { name: "page.count", label: "Total pages", kind: "number", sample: 5 },
  { name: "page.name", label: "Current page name", kind: "string", sample: "Introduction" },
  { name: "section.name", label: "Current section name", kind: "string", sample: "Overview" },
];

/** Score → 0–100 percent, guarding divide-by-zero. */
export function scorePercent(score: ActivityScore): number {
  return score.possible > 0
    ? Math.round((score.earned / score.possible) * 100)
    : 0;
}

/** Assemble the live runtime scope the engine evaluates against. The single
 *  place variable names are bound to values — keep the keys in sync with
 *  {@link VARIABLE_DEFS}. */
export function buildScope(
  score: ActivityScore,
  pageNumber: number,
  pageCount: number,
  pageName: string,
  sectionName: string,
  learner: Learner,
): VariableScope {
  return {
    "learner.first_name": learner.first_name,
    "learner.last_name": learner.last_name,
    "score.earned": score.earned,
    "score.possible": score.possible,
    "score.percent": scorePercent(score),
    "score.correct": score.correct,
    "score.total": score.total,
    "page.number": pageNumber,
    "page.count": pageCount,
    "page.name": pageName,
    "section.name": sectionName,
  };
}

/** The editor/no-provider fallback scope, built from each variable's sample. */
export const SAMPLE_SCOPE: VariableScope = Object.fromEntries(
  VARIABLE_DEFS.map((v) => [v.name, v.sample]),
);
