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

import { type NodeViewComponentProps, useMergedDOMRefs } from "@handlewithcare/react-prosemirror";

import { sectionPaddingClass, sectionPaddingPx } from "../spacing";

export function SectionNodeView({
  ref,
  nodeProps,
  children,
  ...props
}: NodeViewComponentProps) {
  const mergedRef = useMergedDOMRefs(ref, nodeProps.contentDOMRef)
  const attrs = nodeProps.node.attrs;
  // Padding paints through the `py-{unit}` class (the NodeView, not toDOM, is
  // what renders in the editor), so the drag bands' px flows through here.
  const paddingClass = sectionPaddingClass(sectionPaddingPx(attrs));
  const theme = attrs["theme"] as string | undefined;
  const minHeight = (attrs["minHeight"] as string) || "none";
  const contentAlign = (attrs["contentAlign"] as string) || "top";
  const htmlId = (attrs["htmlId"] as string) || "";
  const injectedClass = (props as { className?: string }).className ?? "";
  // `theme -X` scopes the section under the `.theme.-X` CSS-variable
  // sets `themeToCss` emits (pagy's section "Colors"). The background
  // media layer is NOT rendered here — it comes from
  // `SectionBackgroundWidget` (a PM widget decoration), so shuffle's
  // posAtCoords never sees a foreign child in the contentDOM.
  return (
    <section
      ref={mergedRef}
      {...props}
      className={`${injectedClass} pp-section ${paddingClass}${theme ? ` theme -${theme}` : ""}`.trim()}
      data-node-type="section"
      {...(theme ? { "data-theme": theme } : {})}
      {...(minHeight !== "none" ? { "data-min-height": minHeight } : {})}
      {...(contentAlign !== "top" ? { "data-content-align": contentAlign } : {})}
      {...(htmlId ? { id: htmlId } : {})}
      contentEditable={true}
      suppressContentEditableWarning
    >
      {children}
    </section>
  );
}
