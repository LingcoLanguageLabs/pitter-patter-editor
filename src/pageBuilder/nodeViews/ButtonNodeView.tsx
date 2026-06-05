/**
 * NodeView for the `button` schema node. Renders an `<a>` styled as
 * a Pagy-style CTA pill. The label, variant, and href come from the
 * node's attrs; the element itself is non-editable (atom).
 *
 * Why a NodeView at all: shuffle's grid math attaches `start-N end-N`
 * classes and `grid-row: N` style to each block via `{...props}`. If
 * we let PM render the button from its `toDOM` spec, those decoration
 * props don't make it to the DOM and the button escapes the column
 * grid. Custom NodeViews MUST spread `{...props}` for shuffle to work.
 */

import type { NodeViewComponentProps } from "@handlewithcare/react-prosemirror";

export function ButtonNodeView({
  ref,
  nodeProps,
  children: _children,
  ...props
}: NodeViewComponentProps) {
  const variant = (nodeProps.node.attrs["variant"] as string) || "primary";
  const label = nodeProps.node.attrs["label"] as string;
  const href = (nodeProps.node.attrs["href"] as string) || "#";
  const injectedClass = (props as { className?: string }).className ?? "";
  return (
    <a
      ref={ref}
      {...props}
      href={href}
      className={`pp-button pp-button--${variant} ${injectedClass}`.trim()}
      data-node-type="button"
      data-variant={variant}
      onClick={(e) => e.preventDefault()}
      contentEditable={false}
      suppressContentEditableWarning
    >
      {label}
    </a>
  );
}
