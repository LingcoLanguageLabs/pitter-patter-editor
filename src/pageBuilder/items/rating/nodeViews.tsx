/**
 * Rating — builder NodeViews. The author edits the prompt inline (like any item
 * stem); the scale itself is configured in the settings panel (icon style, count,
 * end labels) and shown here as a static, non-interactive PREVIEW so the canvas
 * matches what the student gets. `...props` MUST land on the outer element so the
 * shuffle grid classes apply.
 *
 *   RatingView       — block chrome: the prompt + the scale preview + end labels.
 *   RatingPromptView — the editable "put anything" stem (+ "Add to question").
 */

import { type NodeViewComponentProps } from "@handlewithcare/react-prosemirror";

import { useItemBuilderTools } from "../shared/blockTools";
import { ratingGlyph } from "./icons";
import type { RatingIconStyle } from "./schema";

function injectedClass(props: object): string {
  return (props as { className?: string }).className ?? "";
}

export function RatingView({
  nodeProps,
  ref,
  children,
  ...props
}: NodeViewComponentProps) {
  const a = nodeProps.node.attrs;
  const scale = typeof a["scale"] === "number" ? (a["scale"] as number) : 5;
  const icon = (a["icon"] as RatingIconStyle) || "star";
  const low = (a["lowLabel"] as string) || "";
  const high = (a["highLabel"] as string) || "";
  const className = ["pp-rating", injectedClass(props)]
    .filter(Boolean)
    .join(" ");
  return (
    <div ref={ref} {...props} className={className} data-node-type="rating">
      <div ref={nodeProps.contentDOMRef} className="pp-rating-content">
        {children}
      </div>
      {/* Static scale preview — chrome, not editable. Re-derived each render so
          it tracks the settings panel (icon / count / labels) live. */}
      <div
        className="pp-rating-scale pp-rating-scale--preview"
        data-icon={icon}
        contentEditable={false}
      >
        {Array.from({ length: Math.max(2, scale) }, (_, i) => (
          <span key={i} className="pp-rating-icon">
            {ratingGlyph(icon, scale, i, false)}
          </span>
        ))}
      </div>
      {(low || high) && (
        <div className="pp-rating-labels" contentEditable={false}>
          <span>{low}</span>
          <span>{high}</span>
        </div>
      )}
    </div>
  );
}

export function RatingPromptView({
  nodeProps,
  ref,
  children,
  ...props
}: NodeViewComponentProps) {
  const tools = useItemBuilderTools();
  const className = ["pp-rating-prompt-wrapper", injectedClass(props)]
    .filter(Boolean)
    .join(" ");
  return (
    <div ref={ref} {...props} className={className}>
      <div ref={nodeProps.contentDOMRef} className="pp-rating-prompt">
        {children}
      </div>
      {tools && (
        <tools.AddContentBlock
          getContainerPos={nodeProps.getPos}
          className="pp-mc-add pp-mc-add--stem"
          label="Add to question"
        />
      )}
    </div>
  );
}
