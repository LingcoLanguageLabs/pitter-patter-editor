/**
 * Ordering — builder NodeViews. Authored inline in the one ProseMirror doc: the
 * prompt + item cards are editable text; the author drags cards with shuffle to
 * set the correct sequence (each draggable card gets a shuffle handle
 * automatically). `...props` MUST be spread onto the outer element of each view
 * so the shuffle grid classes the plugin decorates onto `ord` land on the DOM.
 *
 *   OrdView      — block chrome: the content (prompt + item cards) + "Add item".
 *   OrdPromptView — the question stem (a block container, like MC/Categorization).
 *   OrdItemView  — one draggable card: a position number (the answer key the
 *                  author is building), the editable text, and a delete button.
 */

import {
  useEditorEventCallback,
  useEditorState,
  type NodeViewComponentProps,
} from "@handlewithcare/react-prosemirror";
import { Trash } from "@phosphor-icons/react";
import type { Node as PmNode } from "prosemirror-model";

import { useItemBuilderTools } from "../shared/blockTools";
import { newId } from "../shared/ids";
import { ORD_ITEM_NODE } from "./schema";

function injectedClass(props: object): string {
  return (props as { className?: string }).className ?? "";
}

export function OrdView({
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
    const itemType = view.state.schema.nodes[ORD_ITEM_NODE];
    if (!itemType) return;
    const endOfContent = pos + node.nodeSize - 1;
    const item = itemType.create(
      { cardId: newId("card") },
      view.state.schema.text("Item"),
    );
    view.dispatch(view.state.tr.insert(endOfContent, item).scrollIntoView());
  });

  const className = ["pp-ord", injectedClass(props)].filter(Boolean).join(" ");

  return (
    <div ref={ref} {...props} className={className}>
      {/* Identity comes from the shuffle handle pill + block menu; no baked-in
          label. Points lives in the block menu (SettingsForm). */}
      <div ref={contentDOMRef} className="pp-ord-content">
        {children}
      </div>
      <button
        type="button"
        contentEditable={false}
        onMouseDown={(e) => e.preventDefault()}
        onClick={addItem}
        className="pp-ord-add"
      >
        + Add item
      </button>
    </div>
  );
}

export function OrdPromptView({
  nodeProps,
  ref,
  children,
  ...props
}: NodeViewComponentProps) {
  // The stem is a block container: it renders its child blocks (a paragraph by
  // default) and offers "+ Add to question" so the author can drop in images,
  // audio, headings, etc. The add control is injected by the page builder.
  const tools = useItemBuilderTools();
  const className = ["pp-ord-prompt-wrapper", injectedClass(props)]
    .filter(Boolean)
    .join(" ");
  return (
    <div ref={ref} {...props} className={className}>
      <div ref={nodeProps.contentDOMRef} className="pp-ord-prompt">
        {children}
      </div>
      {tools && (
        <tools.AddContentBlock
          getContainerPos={nodeProps.getPos}
          className="pp-ord-add pp-ord-add--stem"
          label="Add to question"
        />
      )}
    </div>
  );
}

export function OrdItemView({
  nodeProps,
  ref,
  children,
  ...props
}: NodeViewComponentProps) {
  const { node, getPos } = nodeProps;

  // The card's 1-based ordinal among its `ord_item` siblings = its place in the
  // answer sequence. Read off the live state so it updates as cards reorder. The
  // delete guard keeps ≥1 item (schema `ord_item+`).
  const editorState = useEditorState();
  let ordinal = 0;
  let canDelete = false;
  const pos = getPos();
  if (editorState && pos != null) {
    const $pos = editorState.doc.resolve(pos);
    const parentStart = $pos.start();
    let count = 0;
    let mine = 0;
    $pos.parent.forEach((child: PmNode, offset: number) => {
      if (child.type.name !== ORD_ITEM_NODE) return;
      count += 1;
      if (parentStart + offset === pos) mine = count;
    });
    ordinal = mine;
    canDelete = count > 1;
  }

  const deleteItem = useEditorEventCallback((view) => {
    if (!view) return;
    const p = getPos();
    if (p == null || !canDelete) return;
    view.dispatch(view.state.tr.delete(p, p + node.nodeSize));
  });

  const className = ["pp-ord-item", injectedClass(props)]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={ref} {...props} className={className}>
      <span className="pp-ord-item-index" contentEditable={false}>
        {ordinal || ""}
      </span>
      <div ref={nodeProps.contentDOMRef} className="pp-ord-item-text">
        {children}
      </div>
      <button
        type="button"
        contentEditable={false}
        onMouseDown={(e) => e.preventDefault()}
        onClick={deleteItem}
        disabled={!canDelete}
        className="pp-ord-item-delete"
        aria-label="Delete item"
        title={canDelete ? "Delete item" : "A question needs at least one item"}
      >
        <Trash size={12} weight="bold" />
      </button>
    </div>
  );
}
