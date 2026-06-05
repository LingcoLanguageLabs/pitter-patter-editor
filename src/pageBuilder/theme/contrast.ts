// Unminified from: _next/unpacked/modules/layout/791646/0133__tg.js
// Original name: `tg`.
//
// `hasLowContrast(a, b, threshold=2.2)` — returns `true` when the chroma
// `contrast` ratio of the two colors is **above** the threshold (which the
// shipped source uses as "show 'Not enough contrast' tooltip"). The
// predicate name in the bundle reads backwards from what the call sites
// do with it, so we preserve the ratio + direction verbatim rather than
// second-guess the intent.

import chroma from "chroma-js";

/** Original name: `tg`. */
export function hasLowContrast(
  a: string | undefined | null,
  b: string | undefined | null,
  threshold: number = 2.2,
): boolean {
  if (!a || !b) return false;
  return chroma.contrast(a, b) > threshold;
}
