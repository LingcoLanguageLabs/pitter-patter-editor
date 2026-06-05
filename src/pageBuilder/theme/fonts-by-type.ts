// Unminified from: module 791646 statements 0588–0591
//
//   `oj` → SANS_FONTS   — FONTS_DEFAULT.filter(type === "sans-serif")
//   `ok` → SERIF_FONTS  — FONTS_DEFAULT.filter(type === "serif")
//   `oN` → MONO_FONTS   — FONTS_DEFAULT.filter(type === "monospace")
//   `oC` → WEIGHT_LABELS — numeric font weight → display label

import { FONTS_DEFAULT } from "./fonts";

/** Original name: `oj`. */
export const SANS_FONTS = FONTS_DEFAULT.filter((f) => f.type === "sans-serif");

/** Original name: `ok`. */
export const SERIF_FONTS = FONTS_DEFAULT.filter((f) => f.type === "serif");

/** Original name: `oN`. */
export const MONO_FONTS = FONTS_DEFAULT.filter((f) => f.type === "monospace");

/** Original name: `oC`. Display label for numeric font weights. */
export const WEIGHT_LABELS: Record<number, string> = {
  300: "Light",
  400: "Regular",
  425: "Regular",
  450: "Regular",
  500: "Medium",
  525: "Medium",
  600: "Semi Bold",
  700: "Bold",
  800: "Extra Bold",
  900: "Black",
};
