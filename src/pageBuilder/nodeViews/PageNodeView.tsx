/**
 * NodeView for the `page` node — a slide.
 *
 * Render-gating: only the ACTIVE slide renders its `children` (its
 * sections). Inactive slides render an empty wrapper with NO children, so
 * their descendants — sections, blocks, and any interactive widgets —
 * never mount. The deck stays one document; only one slide is ever live.
 *
 * react-prosemirror tolerates the missing contentDOM (it marks the node
 * non-editable and forces a re-render when content appears/disappears), so
 * switching slides cleanly mounts the newly-active page and unmounts the
 * old one. `activePagePlugin.setActivePage` moves the selection into the
 * new page on switch, so the cursor is never stranded in an unmounted slide.
 */

import {
  useEditorState,
  type NodeViewComponentProps,
  useMergedDOMRefs,
} from "@handlewithcare/react-prosemirror";

import { getActivePageId } from "../activePagePlugin";

export function PageNodeView({
  ref,
  nodeProps,
  children,
  ...props
}: NodeViewComponentProps) {
  const mergedRef = useMergedDOMRefs(ref, nodeProps.contentDOMRef)
  const id = (nodeProps.node.attrs["id"] as string) || "";
  const active = id !== "" && id === getActivePageId(useEditorState());
  const injectedClass = (props as { className?: string }).className ?? "";
  return (
    <div
      ref={mergedRef}
      {...props}
      className={`${injectedClass} pb-page`.trim()}
      data-node-type="page"
      data-active={active || undefined}
      contentEditable={active}
      suppressContentEditableWarning
    >
      {active ? children : null}
    </div>
  );
}
