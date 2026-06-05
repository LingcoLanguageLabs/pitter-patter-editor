/**
 * Injects the active theme as scoped CSS into the document head.
 *
 * Two `<style>` tags:
 *
 *   1. `data-pb-theme-faces` — `@font-face` blocks for every font in
 *      `FONTS_DEFAULT`. Pagy serves the same `.woff2` files we point at
 *      via `https://cdn.pagy.co/fonts/...` (the URLs are baked into
 *      `font-face-css.ts` so the catalog is shared). This is loaded
 *      once, regardless of which font the theme picks, so the Fonts
 *      panel's hover-preview is instant.
 *
 *   2. `data-pb-theme-vars` — the output of `themeToCss(theme)`, which
 *      writes the CSS variables `.site` reads (`--color-primary`,
 *      `--font-family-base`, etc.). Re-renders on every theme change.
 *
 * The canvas already wraps its content in `.site` (matching pagy's
 * runtime), so the variables cascade naturally without any per-element
 * inline styles.
 */

import { useEffect } from "react";

import { usePageBuilderStore } from "./store";
import { FONTS_DEFAULT } from "./theme/fonts";
import { allFontFaceCss } from "./theme/font-face-css";
import { themeToCss } from "./theme/css";

/** Font-face declarations are stable for the lifetime of the editor, so
 *  we only stringify them once. */
const ALL_FONT_FACE_CSS = allFontFaceCss(FONTS_DEFAULT);

export function ThemeStyle() {
  const theme = usePageBuilderStore((s) => s.theme);

  useEffect(() => {
    const id = "pb-theme-faces";
    if (document.getElementById(id)) return;
    const el = document.createElement("style");
    el.id = id;
    el.setAttribute("data-pb-theme-faces", "");
    el.textContent = ALL_FONT_FACE_CSS;
    document.head.appendChild(el);
  }, []);

  useEffect(() => {
    const id = "pb-theme-vars";
    let el = document.getElementById(id) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = id;
      el.setAttribute("data-pb-theme-vars", "");
      document.head.appendChild(el);
    }
    el.textContent = themeToCss(theme);
  }, [theme]);

  return null;
}
