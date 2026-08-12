/**
 * Fill model — the seam that lets a "colour" be either a solid or a gradient
 * without breaking everything downstream that still needs a solid.
 *
 * A theme colour is stored as a plain CSS string (back-compat: a bare hex is
 * still just a hex). When it's a gradient, the same string holds the full
 * `…-gradient(…)` value. The pure string⇄spec parsing lives in `./gradient`
 * (and is unit-tested there); this module adds the theme-facing glue:
 *
 *   • `fillBaseColor(v)`   — a representative SOLID for contrast math / any
 *                            `color`/border use (gradients are background-only)
 *   • `fillToCssImage(v)`  — the gradient string for `background-image`, or
 *                            `"none"` for a solid (so the solid path is a no-op)
 *   • `defaultGradient(c)` — a pleasant starter gradient from a solid colour
 */

import chroma from "chroma-js";

import { isGradient, parseGradient, type GradientSpec } from "./gradient";

// Re-export the parsing helpers so existing imports from "./theme/fill" keep
// working and callers have a single entry point.
export * from "./gradient";

/** A solid colour to drive contrast math and any non-background use. For a
 *  gradient we take the first stop — predictable and good enough for v1. */
export function fillBaseColor(value: string): string {
  if (!isGradient(value)) return value;
  const g = parseGradient(value);
  if (!g || !g.stops.length) return "#ffffff";
  return g.stops[0]!.color;
}

/** The gradient string for `background-image`, or `"none"` for a solid — so the
 *  solid path emits `background-image: none` and renders exactly as before. */
export function fillToCssImage(value: string): string {
  return isGradient(value) ? value : "none";
}

/** A pleasant starting gradient when switching a solid → gradient: the colour
 *  fading into a lighter tint of itself. */
export function defaultGradient(from: string): GradientSpec {
  const base = chroma.valid(from) ? chroma(from).hex() : "#7f7f7f";
  const lighter = chroma.mix(base, "#ffffff", 0.55, "rgb").hex();
  return {
    type: "linear",
    angle: 180,
    posX: 50,
    posY: 50,
    stops: [
      { color: base, pos: 0 },
      { color: lighter, pos: 100 },
    ],
  };
}
