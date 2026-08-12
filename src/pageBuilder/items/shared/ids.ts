/**
 * Stable local ids for item instances + their parts (option ids, blank ids…).
 * Stamped at construction so responses can key off them and survive reorders /
 * re-renders. Local-only and good enough for client use; a publish/persist step
 * can re-key server-side later if needed.
 */

let counter = 0;

export function newId(prefix: string): string {
  counter += 1;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${rand}${counter.toString(36)}`;
}
