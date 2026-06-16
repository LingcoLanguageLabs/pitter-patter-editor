/**
 * NodeView for the `footer` node — the site's bottom bar. Renders a
 * `<footer class="pp-footer …">` with PM's content children inside it.
 *
 * Mirrors `SectionNodeView`: vertical padding paints through the `py-{unit}`
 * class (via `footerClass`), the chrome comes from `sectionChromePlugin` as a
 * widget decoration (not a contentDOM child), and the classes are the same
 * ones the schema `toDOM` + runtime walker emit so editor and site match.
 */

import type { NodeViewComponentProps } from "@handlewithcare/react-prosemirror";

import { footerClass } from "../spacing";

export function FooterNodeView({
  ref,
  nodeProps,
  children,
  ...props
}: NodeViewComponentProps) {
  const attrs = nodeProps.node.attrs;
  const injectedClass = (props as { className?: string }).className ?? "";
  return (
    <footer
      ref={ref}
      {...props}
      className={`${injectedClass} ${footerClass(attrs)}`.trim()}
      data-node-type="footer"
      {...(attrs["theme"] ? { "data-theme": attrs["theme"] as string } : {})}
      contentEditable={true}
      suppressContentEditableWarning
    >
      {children}
    </footer>
  );
}
