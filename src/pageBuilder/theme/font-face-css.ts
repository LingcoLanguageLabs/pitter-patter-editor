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

/** Concatenates `@font-face` blocks for every CDN-served font in the catalog.
 *  Skipped: `source: "google"` (loaded from Google Fonts via {@link
 *  googleFontsHref}'s `<link>`) and `source: "self"` (self-hosted with a
 *  hand-written `@font-face` carrying metric overrides — e.g. Playfair Display,
 *  whose generous ascent/descent is trimmed so the caret hugs the glyphs; see
 *  page-builder.css). */
export function allFontFaceCss(fonts: FontDef[]): string {
  return fonts
    .filter((font) => font.source !== "google" && font.source !== "self")
    .map(fontFaceCssFor)
    .join(" ");
}

/**
 * Builds a single Google Fonts `css2` stylesheet URL for every `source:
 * "google"` font in `fonts`, or "" when there are none. We load these directly
 * from Google rather than `cdn.pagy.co` so the editor isn't limited to whatever
 * pagy happens to mirror.
 *
 * The `weights` listed on each FontDef MUST be ones Google actually serves for
 * that family — Google `css2` rejects the WHOLE request (HTTP 400) on an
 * unknown weight (e.g. Playfair Display has no 300 on Google).
 *
 * Variable fonts are requested as a `min..max` RANGE (so any weight in between
 * — e.g. a 375/425/450 `regular` — renders from the real variable file);
 * static fonts list their exact served `weights`. Italic tuples come after
 * normal (`css2` requires ascending `ital,wght`).
 */
export function googleFontsHref(fonts: FontDef[]): string {
  const families = fonts
    .filter((font) => font.source === "google")
    .map((font) => {
      const family = (font.googleFamily ?? font.name).replaceAll(" ", "+");
      const weights = font.weights ?? [400];
      if (font.variable) {
        const lo = Math.min(...weights);
        const hi = Math.max(...weights);
        const range = lo === hi ? `${lo}` : `${lo}..${hi}`;
        return font.italics
          ? `family=${family}:ital,wght@0,${range};1,${range}`
          : `family=${family}:wght@${range}`;
      }
      if (font.italics) {
        const tuples = [
          ...weights.map((w) => `0,${w}`),
          ...weights.map((w) => `1,${w}`),
        ];
        return `family=${family}:ital,wght@${tuples.join(";")}`;
      }
      return `family=${family}:wght@${weights.join(";")}`;
    });
  if (!families.length) return "";
  return `https://fonts.googleapis.com/css2?${families.join("&")}&display=swap`;
}
