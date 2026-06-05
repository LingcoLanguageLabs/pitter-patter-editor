// Unminified from:
//   `tb` (0137) — fontFaceCssFor(font)
//   `tx` (0136) — FONT_FILE_SUFFIX  (300 → "Light", 400 → "Regular", …)
//
// Generates the `@font-face` block(s) for a single font entry. Variable
// fonts get one declaration with `font-weight: 300 900`; static fonts get
// one declaration per numeric weight using the `FONT_FILE_SUFFIX` map to
// build the URL (e.g. `Inter-Regular.woff2`).
//
// Files are served from `https://cdn.pagy.co/fonts/{Name}{weight suffix}.woff2`.

import type { FontDef } from "./fonts";

/** Original name: `tx`. Numeric weight → filename suffix for static-font files. */
export const FONT_FILE_SUFFIX: Record<number, string> = {
  300: "Light",
  400: "Regular",
  500: "Medium",
  600: "SemiBold",
  700: "Bold",
  800: "ExtraBold",
  900: "Black",
};

/** Original name: `tb`. */
export function fontFaceCssFor(font: FontDef): string {
  const base = font.name.replaceAll(" ", "");

  if (font.variable) {
    return `
      @font-face {
        font-family: '${font.name}';
        font-style: normal;
        font-weight: 300 900;
        font-display: block;
        src: url('https://cdn.pagy.co/fonts/${base}.woff2') format('woff2');
      }

      ${
        font.italics
          ? `@font-face {
        font-family: '${font.name}';
        font-style: italic;
        font-weight: 300 900;
        font-display: block;
        src: url('https://cdn.pagy.co/fonts/${base}-Italic.woff2') format('woff2');
      }`
          : ""
      }
    `;
  }

  return (font.weights ?? [])
    .map(
      (weight) => `
      @font-face {
        font-family: '${font.name}';
        font-style: normal;
        font-weight: ${weight};
        font-display: block;
        src: url('https://cdn.pagy.co/fonts/${base}-${FONT_FILE_SUFFIX[weight]}.woff2') format('woff2');
      }

      ${
        font.italics
          ? `@font-face {
        font-family: '${font.name}';
        font-style: italic;
        font-weight: ${weight};
        font-display: block;
        src: url('https://cdn.pagy.co/fonts/${base}-${FONT_FILE_SUFFIX[weight]}-Italic.woff2') format('woff2');
      }`
          : ""
      }
    `,
    )
    .join(" ");
}

/** Concatenates `@font-face` blocks for every font in the catalog. */
export function allFontFaceCss(fonts: FontDef[]): string {
  return fonts.map(fontFaceCssFor).join(" ");
}
