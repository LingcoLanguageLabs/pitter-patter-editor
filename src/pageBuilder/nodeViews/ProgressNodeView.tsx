/**
 * NodeView for the `progress` node — a bar/ring indicator. An atom block, so it
 * has no contentDOM; `{...props}` carries the shuffle decorations (grid +
 * selection ring) onto the figure. The fill color rides as `data-color`, and the
 * inner indicator is the shared `<ProgressIndicator>` — in the editor it
 * evaluates its expression against the SAMPLE scope (no provider), so the author
 * sees a representative value while building.
 */

import type { NodeViewComponentProps } from "@handlewithcare/react-prosemirror";

import { ProgressIndicator } from "../ProgressIndicator";

export function ProgressNodeView({
  ref,
  nodeProps,
  children: _children,
  ...props
}: NodeViewComponentProps) {
  const attrs = nodeProps.node.attrs;
  const injectedClass = (props as { className?: string }).className ?? "";
  return (
    <figure
      ref={ref as React.Ref<HTMLElement>}
      {...props}
      className={`pb-progress ${injectedClass}`.trim()}
      contentEditable={false}
      data-node-type="progress"
      data-display={(attrs["display"] as string) || "bar"}
      data-color={(attrs["color"] as string) || "primary"}
    >
      <ProgressIndicator attrs={attrs} />
    </figure>
  );
}
