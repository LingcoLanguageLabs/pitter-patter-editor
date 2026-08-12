/**
 * SVG helpers for the Vector block — the inline-SVG counterpart to `embed.ts`.
 *
 * The Vector block renders author-pasted SVG markup INLINE (via
 * `dangerouslySetInnerHTML`) so it scales crisply and can inherit `currentColor`
 * for theming — things a plain `<img src=*.svg>` (the Image block) can't do.
 *
 * The page author is trusted (it's their own markup), but inlining still warrants
 * a conservative scrub as defense-in-depth, applied identically in the editor
 * NodeView AND the published-site walker. Regex-based on purpose: it runs the
 * same in the browser and during SSR with no `DOMParser` dependency.
 */

/** Strip the obvious script vectors out of pasted SVG before it's inlined. */
export function sanitizeSvg(markup: string): string {
  if (!markup) return "";
  return (
    markup
      // <script>…</script> and any stray script tags
      .replace(/<script[\s\S]*?<\/script\s*>/gi, "")
      .replace(/<\/?script[^>]*>/gi, "")
      // <foreignObject> can host arbitrary HTML (incl. scripts) — drop it whole
      .replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, "")
      // inline event handlers: on…="…" | on…='…' | on…=bareValue
      .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      // javascript: in href / xlink:href / src — neutralize the target
      .replace(
        /((?:xlink:)?(?:href|src))\s*=\s*(["'])\s*javascript:[^"']*\2/gi,
        "$1=$2#$2",
      )
      .trim()
  );
}

/** Heuristic: does this string look like inline SVG markup (vs a URL/empty)? */
export function isSvgMarkup(value: string): boolean {
  return /<svg[\s>]/i.test(value);
}
