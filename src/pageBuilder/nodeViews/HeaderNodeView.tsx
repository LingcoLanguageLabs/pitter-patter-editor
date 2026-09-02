/**
 * NodeView for the `header` node — the site's top bar. Renders a
 * `<header class="pp-header …">` with PM's content children (a row of
 * wordmark + nav) inside it.
 *
 * Like `SectionNodeView`, the chrome (Add block / settings / delete) is NOT
 * rendered here — it comes from `sectionChromePlugin` as a PM widget
 * decoration, so shuffle's `posAtCoords` never sees a foreign child in the
 * contentDOM. The visual classes come from `headerClass` (shared with the
 * schema `toDOM` + the runtime walker, so editor and published render match).
 */

import { useMergedDOMRefs, type NodeViewComponentProps } from "@handlewithcare/react-prosemirror";

import { headerClass } from "../spacing";

export function HeaderNodeView({
  ref,
  nodeProps,
  children,
  ...props
}: NodeViewComponentProps) {
  const mergedRef = useMergedDOMRefs(ref, nodeProps.contentDOMRef)
  const attrs = nodeProps.node.attrs;
  const injectedClass = (props as { className?: string }).className ?? "";
  return (
    <header
      ref={mergedRef}
      {...props}
      className={`${injectedClass} ${headerClass(attrs)}`.trim()}
      data-node-type="header"
      {...(attrs["fixed"] ? { "data-fixed": "true" } : {})}
      {...(attrs["theme"] ? { "data-theme": attrs["theme"] as string } : {})}
      {...(attrs["background"]
        ? { "data-background": attrs["background"] as string }
        : {})}
      contentEditable={true}
      suppressContentEditableWarning
    >
      {children}
    </header>
  );
}
