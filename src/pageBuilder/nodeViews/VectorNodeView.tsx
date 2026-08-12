/**
 * NodeView for the `vector` schema node — author-pasted INLINE SVG. Renders a
 * `<figure>` whose `.pb-vector-media` holds the sanitized SVG inline (so it
 * scales crisply and can inherit `currentColor`), or an `<img>` when only a URL
 * source is set, or a placeholder while empty. Same rationale as the other media
 * NodeViews for using a NodeView over `toDOM`: the shuffle decorations need to
 * land via `{...props}` (className + grid style).
 *
 * The width % is set inline on the inner `.pb-vector-media` (which this view
 * fully owns) rather than on the figure: react-prosemirror passes the figure's
 * decoration `style` as a STRING, so merging a CSS var into it there silently
 * drops once the block is active. The markup is scrubbed by `sanitizeSvg` before
 * it's inlined.
 */

import { BezierCurve } from "@phosphor-icons/react";
import type { NodeViewComponentProps } from "@handlewithcare/react-prosemirror";
import type { CSSProperties } from "react";

import { isSvgMarkup, sanitizeSvg } from "../svg";

export function VectorNodeView({
  ref,
  nodeProps,
  children: _children,
  ...props
}: NodeViewComponentProps) {
  const a = nodeProps.node.attrs;
  const markup = (a["markup"] as string) || "";
  const src = (a["src"] as string) || "";
  const alt = (a["alt"] as string) || "";
  const width = typeof a["width"] === "number" ? (a["width"] as number) : 100;
  const align = (a["align"] as string) || "center";
  const tint = (a["tint"] as string) || "";

  const injectedClass = (props as { className?: string }).className ?? "";
  const className = ["pb-vector", tint ? `pp-text -${tint}` : "", injectedClass]
    .filter(Boolean)
    .join(" ");
  // Width % rides on the media element (owned here) — see the file header.
  const mediaStyle: CSSProperties = { width: `${width}%` };
  const svg = isSvgMarkup(markup) ? sanitizeSvg(markup) : "";

  return (
    <figure
      ref={ref}
      {...props}
      className={className}
      data-node-type="vector"
      data-align={align}
      {...(tint ? { "data-recolor": "true" } : {})}
    >
      {svg ? (
        <div
          className="pb-vector-media"
          style={mediaStyle}
          // Author's own markup, scrubbed by sanitizeSvg.
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : src ? (
        <div className="pb-vector-media" style={mediaStyle}>
          <img src={src} alt={alt} />
        </div>
      ) : (
        <div className="pb-media-placeholder">
          <BezierCurve size={56} weight="thin" />
        </div>
      )}
    </figure>
  );
}
