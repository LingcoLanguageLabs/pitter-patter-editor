/**
 * Variable scope — assembles the live values `{{ }}` tokens and progress-bar
 * expressions evaluate against, and provides them to the runtime tree.
 *
 * Mounted once by `<SiteRenderer>` (inside the grading provider, so it can read
 * the score). It pulls `score.*` from the reactive grading score, `page.*` from
 * the deck position passed in, and `learner.*` from the learner profile
 * (sample until auth exists). The assembled scope is memoised on its values, so
 * consumers only re-render when a value actually changes.
 *
 * `useVariableScope()` falls back to {@link SAMPLE_SCOPE} when no provider is
 * mounted (thumbnails / static previews), so interpolation still renders
 * plausible sample values instead of blanks.
 */

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { useActivityScore } from "../items/shared/grading";
import type { VariableScope } from "./expression";
import {
  buildScope,
  SAMPLE_LEARNER,
  SAMPLE_SCOPE,
  type Learner,
} from "./registry";

const VariableScopeContext = createContext<VariableScope | null>(null);

export function VariableScopeProvider({
  pageNumber,
  pageCount,
  pageName,
  sectionName,
  learner = SAMPLE_LEARNER,
  children,
}: {
  pageNumber: number;
  pageCount: number;
  /** The active page's title (`page.name`). */
  pageName: string;
  /** The section currently in view (`section.name`); "" when none. */
  sectionName: string;
  learner?: Learner;
  children: ReactNode;
}) {
  const score = useActivityScore();
  // Memoise on the primitive values so the context identity is stable between
  // renders — consumers re-render only when a variable's value changes.
  const scope = useMemo(
    () => buildScope(score, pageNumber, pageCount, pageName, sectionName, learner),
    [
      score.earned,
      score.possible,
      score.correct,
      score.total,
      pageNumber,
      pageCount,
      pageName,
      sectionName,
      learner,
    ],
  );
  return (
    <VariableScopeContext.Provider value={scope}>
      {children}
    </VariableScopeContext.Provider>
  );
}

/** The live variable scope, or the sample scope when no provider is mounted. */
export function useVariableScope(): VariableScope {
  return useContext(VariableScopeContext) ?? SAMPLE_SCOPE;
}
