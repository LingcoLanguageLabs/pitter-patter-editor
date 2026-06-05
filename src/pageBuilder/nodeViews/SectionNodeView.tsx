/**
 * NodeView for the `section` schema node — the top-level white-card
 * wrapper. Renders the section element with PM's content children
 * inside it.
 *
 * The hover-gated insert affordances are NOT rendered here. Those
 * come from `sectionChromePlugin`, which adds a React widget
 * decoration into each section. Keeping the chrome out of the
 * NodeView (and out of the contentDOM) is important: shuffle's
 * `posAtCoords` walks DOM children of the contentDOM to find drop
 * targets, and a non-PM child in there confuses its math.
 *
 * `contentEditable={true}` is explicit because react-prosemirror's
 * default is `false` when the NodeView has a custom render path,
 * and we want the paragraphs/headings PM inserts inside the section
 * to remain editable.
 */

import type { NodeViewComponentProps } from "@handlewithcare/react-prosemirror";

export function SectionNodeView({
  ref,
  nodeProps,
  children,
  ...props
}: NodeViewComponentProps) {
  const padding = (nodeProps.node.attrs["padding"] as string) || "medium";
  const theme = nodeProps.node.attrs["theme"] as string | undefined;
  const injectedClass = (props as { className?: string }).className ?? "";
  return (
    <section
      ref={ref}
      {...props}
      className={`${injectedClass} pp-section`.trim()}
      data-node-type="section"
      data-padding={padding}
      {...(theme ? { "data-theme": theme } : {})}
      contentEditable={true}
      suppressContentEditableWarning
    >
      {children}
    </section>
  );
}
