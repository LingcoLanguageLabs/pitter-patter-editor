/**
 * NodeView for the `divider` node — a horizontal rule. An atom block, so it has
 * no contentDOM; `{...props}` carries the shuffle decorations (grid + selection
 * ring) onto the `<hr>`. The line style comes from `data-variant` (CSS).
 */

import type { NodeViewComponentProps } from "@handlewithcare/react-prosemirror";

export function DividerNodeView({
  ref,
  nodeProps,
  children: _children,
  ...props
}: NodeViewComponentProps) {
  const variant = (nodeProps.node.attrs["variant"] as string) || "solid";
  const injectedClass = (props as { className?: string }).className ?? "";
  return (
    <hr
      ref={ref as React.Ref<HTMLHRElement>}
      {...props}
      className={`pb-divider ${injectedClass}`.trim()}
      data-node-type="divider"
      data-variant={variant}
    />
  );
}
