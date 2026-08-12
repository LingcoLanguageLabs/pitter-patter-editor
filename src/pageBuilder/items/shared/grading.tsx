/**
 * Deck-level grading store — the shared state that lets an "official" Check
 * button grade a scope of prompts (per the site's grading-scope setting), now
 * that prompts no longer own their own Check button.
 *
 * Why a shared store (not per-completer state):
 *   • A button can grade a whole section / page / activity, so grading must
 *     reach prompts the button isn't inside.
 *   • Only the active deck page is mounted, so a prompt's response must SURVIVE
 *     unmount to be gradable from another page ("whole activity"). Responses +
 *     graded flags therefore live here, keyed by the item's stable `itemId`.
 *
 * Grading is per-prompt feedback only (no aggregate score): `gradeScope` just
 * flips the "graded" flag on the targeted prompts; each completer then computes
 * and shows its own correct/incorrect from its own answer key.
 *
 * The provider is mounted once by `<SiteRenderer>`, which also feeds it the
 * doc's item map (itemId → page/section) + the current page/section (for the
 * "current" relative targets). Outside a provider (thumbnails/static preview)
 * the hook degrades to inert local state.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import type { ItemGradeResult } from "../types";

export const GRADE_SCOPES = ["prompt", "section", "page", "activity"] as const;
export type GradeScope = (typeof GRADE_SCOPES)[number];

/** A prompt's place in the deck — built from the doc by `SiteRenderer` so a
 *  scope can be resolved to the set of prompts it covers (works for unmounted
 *  prompts too, unlike DOM containment). */
export interface ItemLocation {
  itemId: string;
  pageId: string;
  sectionId: string;
  /** Grade this item's persisted response → result. Bound by `SiteRenderer`
   *  from the item type's registered `grade()` + its serialized def. Absent ⇒
   *  the item carries no credit (free-response / informational). */
  grade?: (response: unknown) => ItemGradeResult;
}

/** Aggregate score over a scope of items — type-agnostic: each item's own
 *  `grade()` is summed, so it works across every item type. */
export interface ActivityScore {
  /** Points earned across graded items in scope. */
  earned: number;
  /** Points available across graded items in scope. */
  possible: number;
  /** Items fully right (status correct or complete). */
  correct: number;
  /** Items that could be graded (have a grader). */
  graded: number;
  /** All items in scope (graded + free-response). */
  total: number;
}

interface GradingStore {
  /** Persisted responses (survive page nav), keyed by itemId. */
  getResponse: (itemId: string) => unknown;
  setResponse: (itemId: string, response: unknown) => void;
  /** Whether a prompt is currently graded (show feedback). */
  isGraded: (itemId: string) => boolean;
  /** Clear a prompt's graded flag (Try again) — re-enables its input. */
  ungrade: (itemId: string) => void;
  /** Subscribe to graded-flag changes (for useSyncExternalStore). */
  subscribe: (cb: () => void) => () => void;
  /** Grade every prompt the scope/target covers. targetId: a specific
   *  prompt/section/page id, or "current" for the relative section/page. */
  gradeScope: (scope: GradeScope, targetId: string) => void;
  /** Aggregate score over a scope (default: the whole activity). Sums each
   *  item's registered `grade()` over its persisted response — type-agnostic.
   *  Items without a grader contribute to `total` only. */
  score: (scope?: GradeScope, targetId?: string) => ActivityScore;
}

function createStore(): GradingStore & {
  setItems: (items: ItemLocation[]) => void;
  setCurrent: (pageId: string, sectionId: string) => void;
} {
  const responses = new Map<string, unknown>();
  const graded = new Set<string>();
  let items: ItemLocation[] = [];
  let currentPageId = "";
  let currentSectionId = "";
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());

  // The items a scope/target covers — shared by grading and scoring so both
  // resolve a scope identically. "current" resolves to the in-view section /
  // active page.
  const itemsInScope = (scope: GradeScope, targetId: string): ItemLocation[] => {
    const target =
      targetId === "current"
        ? scope === "section"
          ? currentSectionId
          : currentPageId
        : targetId;
    return items.filter((it) => {
      if (scope === "activity") return true;
      if (scope === "prompt") return it.itemId === target;
      if (scope === "section") return it.sectionId === target;
      return it.pageId === target; // page
    });
  };

  return {
    getResponse: (id) => responses.get(id),
    setResponse: (id, r) => {
      responses.set(id, r);
      // Editing an answer clears its feedback, so it can be re-checked.
      if (graded.delete(id)) emit();
    },
    isGraded: (id) => graded.has(id),
    // Clear a prompt's graded flag (Try again) — hides feedback and re-enables
    // the input without touching the response, so the learner can re-attempt.
    ungrade: (id) => {
      if (graded.delete(id)) emit();
    },
    subscribe: (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    gradeScope: (scope, targetId) => {
      const ids = itemsInScope(scope, targetId).map((it) => it.itemId);
      let changed = false;
      for (const id of ids) if (!graded.has(id)) (graded.add(id), (changed = true));
      if (changed) emit();
    },
    score: (scope = "activity", targetId = "") => {
      const inScope = itemsInScope(scope, targetId);
      let earned = 0;
      let possible = 0;
      let correct = 0;
      let gradedCount = 0;
      for (const it of inScope) {
        if (!it.grade) continue; // free-response / informational — no credit
        const res = it.grade(responses.get(it.itemId));
        gradedCount += 1;
        earned += res.earned;
        possible += res.possible;
        if (res.status === "correct" || res.status === "complete") correct += 1;
      }
      return {
        earned,
        possible,
        correct,
        graded: gradedCount,
        total: inScope.length,
      };
    },
    setItems: (next) => {
      items = next;
    },
    setCurrent: (pageId, sectionId) => {
      currentPageId = pageId;
      currentSectionId = sectionId;
    },
  };
}

const GradingContext = createContext<GradingStore | null>(null);

export function GradingProvider({
  items,
  currentPageId,
  currentSectionId,
  children,
}: {
  items: ItemLocation[];
  currentPageId: string;
  currentSectionId: string;
  children: ReactNode;
}) {
  // One store instance for the deck's lifetime; props feed it the live map +
  // current ids without recreating it (which would drop responses).
  const storeRef = useRef<ReturnType<typeof createStore> | null>(null);
  if (!storeRef.current) storeRef.current = createStore();
  storeRef.current.setItems(items);
  storeRef.current.setCurrent(currentPageId, currentSectionId);
  return (
    <GradingContext.Provider value={storeRef.current}>
      {children}
    </GradingContext.Provider>
  );
}

/** Button-side: the grade trigger + aggregate scorer. Null outside a provider. */
export function useGrading(): Pick<
  GradingStore,
  "gradeScope" | "score"
> | null {
  return useContext(GradingContext);
}

const EMPTY_SCORE: ActivityScore = {
  earned: 0,
  possible: 0,
  correct: 0,
  graded: 0,
  total: 0,
};

/** Reactive aggregate score — recomputes when grading/responses change (the
 *  store emits on every grade + un-grade). Used by the variable scope so
 *  `score.*` tokens and score-bound progress bars stay live. EMPTY outside a
 *  provider. */
export function useActivityScore(
  scope: GradeScope = "activity",
  targetId = "",
): ActivityScore {
  const store = useContext(GradingContext);
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => store?.subscribe(bump), [store]);
  return store ? store.score(scope, targetId) : EMPTY_SCORE;
}

/** Completer-side: a prompt's persisted response + graded flag. Editing via
 *  `persist` clears the graded flag (feedback) for re-checking. Outside a
 *  provider, inert (never graded, response not persisted). */
export function useItemGrading(itemId: string): {
  graded: boolean;
  initialResponse: unknown;
  persist: (response: unknown) => void;
  /** Clear this prompt's graded flag (Try again). */
  reset: () => void;
} {
  const store = useContext(GradingContext);
  const graded = useSyncExternalStore(
    store ? store.subscribe : noopSubscribe,
    () => (store ? store.isGraded(itemId) : false),
  );
  const initialResponse = useMemo(
    () => store?.getResponse(itemId),
    [store, itemId],
  );
  return {
    graded,
    initialResponse,
    persist: (r) => store?.setResponse(itemId, r),
    reset: () => store?.ungrade(itemId),
  };
}

const noopSubscribe = () => () => {};
