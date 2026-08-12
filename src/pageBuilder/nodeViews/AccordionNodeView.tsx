/**
 * Accordion — builder NodeViews. Authored inline in the one ProseMirror doc:
 * every panel is shown OPEN so the author can edit titles + bodies directly (the
 * collapse is runtime-only). `{...props}` MUST land on each view's outer element
 * so the shuffle grid / drag classes apply.
 *
 *   AccordionView       — block chrome: the items + an "Add item" button.
 *   AccordionItemView   — one row (header + panel) + a delete-row button.
 *   AccordionHeaderView — the editable title, with a (decorative) disclosure caret.
 *   AccordionPanelView  — the editable body ("put anything", + "Add to panel").
 */

import {
  useEditorEventCallback,
  useEditorState,
  type NodeViewComponentProps,
} from "@handlewithcare/react-prosemirror";
import { Trash } from "@phosphor-icons/react";
import type { Node as PmNode } from "prosemirror-model";

import { useItemBuilderTools } from "../items/shared/blockTools";
import { ACCORDION_ITEM_NODE } from "../blocks/accordion";

function injectedClass(props: object): string {
  return (props as { className?: string }).className ?? "";
}

export function AccordionView({
  nodeProps,
  ref,
  children,
  ...props
}: NodeViewComponentProps) {
  const { node, getPos, contentDOMRef } = nodeProps;
  const addItem = useEditorEventCallback((view) => {
    if (!view) return;
    const pos = getPos();
    if (pos == null) return;
    const itemType = view.state.schema.nodes[ACCORDION_ITEM_NODE];
    const newItem = itemType?.createAndFill();
    if (!newItem) return;
    const endOfContent = pos + node.nodeSize - 1;
    view.dispatch(view.state.tr.insert(endOfContent, newItem).scrollIntoView());
  });
  const className = ["pb-accordion", injectedClass(props)]
    .filter(Boolean)
    .join(" ");
  return (
    <div ref={ref} {...props} className={className} data-node-type="accordion">
      <div ref={contentDOMRef} className="pb-accordion-items">
        {children}
      </div>
      <button
        type="button"
        contentEditable={false}
        onMouseDown={(e) => e.preventDefault()}
        onClick={addItem}
        className="pb-block-add"
      >
        + Add item
      </button>
    </div>
  );
}

export function AccordionItemView({
  nodeProps,
  ref,
  children,
  ...props
}: NodeViewComponentProps) {
  const { node, getPos } = nodeProps;
  const editorState = useEditorState();

  let canDelete = false;
  const pos = getPos();
  if (editorState && pos != null) {
    const parent = editorState.doc.resolve(pos).parent;
    let count = 0;
    parent.forEach((c: PmNode) => {
      if (c.type.name === ACCORDION_ITEM_NODE) count += 1;
    });
    canDelete = count > 1;
  }

  const deleteItem = useEditorEventCallback((view) => {
    if (!view) return;
    const p = getPos();
    if (p == null) return;
    view.dispatch(view.state.tr.delete(p, p + node.nodeSize));
  });

  const className = ["pb-accordion-item", injectedClass(props)]
    .filter(Boolean)
    .join(" ");
  // Mirror the `open` attr as data-open so the caret shows which rows open by
  // default; panels stay editable regardless (builder shows them all).
  return (
    <div
      ref={ref}
      {...props}
      className={className}
      {...(node.attrs["open"] ? { "data-open": "true" } : {})}
    >
      <div ref={nodeProps.contentDOMRef} className="pb-accordion-item-content">
        {children}
      </div>
      <button
        type="button"
        contentEditable={false}
        onMouseDown={(e) => e.preventDefault()}
        onClick={deleteItem}
        disabled={!canDelete}
        className="pb-accordion-item-delete"
        aria-label="Delete row"
        title={canDelete ? "Delete row" : "An accordion needs at least one row"}
      >
        <Trash size={14} weight="bold" />
      </button>
    </div>
  );
}

export function AccordionHeaderView({
  nodeProps,
  ref,
  children,
  ...props
}: NodeViewComponentProps) {
  const className = ["pb-accordion-header", injectedClass(props)]
    .filter(Boolean)
    .join(" ");
  return (
    <div ref={ref} {...props} className={className}>
      <span className="pb-accordion-caret" contentEditable={false} aria-hidden />

      <div ref={nodeProps.contentDOMRef} className="pb-accordion-header-text">
        {children}
      </div>
    </div>
  );
}

export function AccordionPanelView({
  nodeProps,
  ref,
  children,
  ...props
}: NodeViewComponentProps) {
  const tools = useItemBuilderTools();
  const className = ["pb-accordion-panel", injectedClass(props)]
    .filter(Boolean)
    .join(" ");
  return (
    <div ref={ref} {...props} className={className}>
      <div ref={nodeProps.contentDOMRef} className="pb-accordion-panel-content">
        {children}
      </div>
      {tools && (
        <tools.AddContentBlock
          getContainerPos={nodeProps.getPos}
          className="pb-block-add pb-block-add--nested"
          label="Add to panel"
        />
      )}
    </div>
  );
}
