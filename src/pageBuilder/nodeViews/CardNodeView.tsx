/**
 * NodeView for the `card` node — a styled block container. Renders a
 * `<div class="pp-card">` with PM's content children inside it.
 *
 * Padding / radius / overlay come from `attrClassesPlugin` classes
 * (pp-padding-*, pp-radius-*, pp-overlay-*); the color is a `theme -X`
 * variant class (see below). The background image is the one thing
 * classes can't express (an arbitrary
 * URL), so it's applied as an inline `background-image` merged onto
 * whatever decoration style shuffle injected (e.g. `grid-row`). The
 * overlay is a CSS `::before` and the image is a CSS background — both
 * avoid adding non-PM children into the contentDOM, which would
 * confuse shuffle's `posAtCoords` drop-target math (see SectionNodeView).
 */

import type { NodeViewComponentProps } from "@handlewithcare/react-prosemirror";
import type { CSSProperties } from "react";

export function CardNodeView({
  ref,
  nodeProps,
  children,
  ...props
}: NodeViewComponentProps) {
  const image = (nodeProps.node.attrs["image"] as string) || "";
  // `theme -X` (default included) re-establishes the card's own palette via
  // themeToCss's `.theme.-X` scope, so it's self-contained regardless of the
  // section it's nested in — the same mechanism as `.pp-section`.
  const theme = (nodeProps.node.attrs["theme"] as string) || "";
  const { className: injectedClass = "", style: injectedStyle } = props as {
    className?: string;
    style?: CSSProperties;
  };
  const style: CSSProperties | undefined = image
    ? { ...injectedStyle, backgroundImage: `url("${image}")` }
    : injectedStyle;
  return (
    <div
      ref={ref}
      {...props}
      className={`${injectedClass} pp-card theme -${theme || "default"}`.trim()}
      data-node-type="card"
      style={style}
      contentEditable={true}
      suppressContentEditableWarning
    >
      {children}
    </div>
  );
}
