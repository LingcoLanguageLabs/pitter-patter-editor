/**
 * Rating — scale-icon rendering, shared by the completer (interactive) and the
 * builder node view (static preview) so the canvas matches the published item.
 *
 *   • star / heart — fill CUMULATIVELY: icons 1..value are "on" (a classic star
 *     rating). Rendered with phosphor's fill vs regular weight.
 *   • emoji        — a sad→happy face ramp, SINGLE-select (you pick the face that
 *     matches your feeling); sampled across the ramp for the chosen scale length.
 *   • number       — numbered chips, single-select.
 */

import { Heart, Star } from "@phosphor-icons/react";
import type { ReactNode } from "react";

import type { RatingIconStyle } from "./schema";

/** star/heart fill up to the value; emoji/number highlight only the picked one. */
export function isCumulative(style: RatingIconStyle): boolean {
  return style === "star" || style === "heart";
}

/** Sad → happy face ramp; `faceFor` samples it across a scale of any length. */
const FACE_RAMP = ["😠", "🙁", "😐", "🙂", "😄"] as const;
export function faceFor(scale: number, index: number): string {
  if (scale <= 1) return FACE_RAMP[FACE_RAMP.length - 1]!;
  const t = index / (scale - 1);
  return FACE_RAMP[Math.round(t * (FACE_RAMP.length - 1))]!;
}

/** The glyph for one position. `on` = filled (cumulative) / selected (single). */
export function ratingGlyph(
  style: RatingIconStyle,
  scale: number,
  index: number,
  on: boolean,
): ReactNode {
  switch (style) {
    case "star":
      return <Star size={28} weight={on ? "fill" : "regular"} />;
    case "heart":
      return <Heart size={28} weight={on ? "fill" : "regular"} />;
    case "emoji":
      return <span className="pp-rating-emoji">{faceFor(scale, index)}</span>;
    case "number":
      return <span className="pp-rating-number">{index + 1}</span>;
  }
}
