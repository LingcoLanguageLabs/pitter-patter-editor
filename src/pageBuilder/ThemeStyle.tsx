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
import { allFontFaceCss, googleFontsHref } from "./theme/font-face-css";
import { themeToCss } from "./theme/css";

/** Font-face declarations are stable for the lifetime of the editor, so
 *  we only stringify them once. CDN-served fonts (`cdn.pagy.co`) go in the
 *  `@font-face` block; `source: "google"` fonts load from Google Fonts via a
 *  `<link>` (their families aren't all mirrored on the pagy CDN). */
const ALL_FONT_FACE_CSS = allFontFaceCss(FONTS_DEFAULT);
const GOOGLE_FONTS_HREF = googleFontsHref(FONTS_DEFAULT);

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

    // Google-sourced fonts (e.g. Spectral) load from Google Fonts rather than
    // the pagy CDN. Inject the stylesheet + preconnects once, alongside the
    // CDN @font-face block.
    if (GOOGLE_FONTS_HREF && !document.getElementById("pb-theme-google-fonts")) {
      for (const [host, crossorigin] of [
        ["https://fonts.googleapis.com", false],
        ["https://fonts.gstatic.com", true],
      ] as const) {
        const pre = document.createElement("link");
        pre.rel = "preconnect";
        pre.href = host;
        if (crossorigin) pre.crossOrigin = "anonymous";
        document.head.appendChild(pre);
      }
      const link = document.createElement("link");
      link.id = "pb-theme-google-fonts";
      link.rel = "stylesheet";
      link.href = GOOGLE_FONTS_HREF;
      document.head.appendChild(link);
    }
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
