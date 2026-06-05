/**
 * NodeView for the `image` schema node. Renders a `<figure>` with
 * an `<img>` inside. Same rationale as `ButtonNodeView` for using a
 * NodeView instead of `toDOM`: shuffle decorations need to land via
 * `{...props}`.
 */

import type { NodeViewComponentProps } from "@handlewithcare/react-prosemirror";

export function ImageNodeView({
  ref,
  nodeProps,
  children: _children,
  ...props
}: NodeViewComponentProps) {
  const src = (nodeProps.node.attrs["src"] as string) || "";
  const alt = (nodeProps.node.attrs["alt"] as string) || "";
  const aspect = (nodeProps.node.attrs["aspect"] as string) || "16/9";
  const injectedClass = (props as { className?: string }).className ?? "";
  return (
    <figure
      ref={ref}
      {...props}
      className={`pp-image ${injectedClass}`.trim()}
      data-node-type="image"
      data-aspect={aspect}
    >
      <img src={src} alt={alt} draggable={false} />
    </figure>
  );
}
