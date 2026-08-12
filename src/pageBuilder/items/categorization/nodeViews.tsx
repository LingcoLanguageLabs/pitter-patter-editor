/**
 * Categorization — builder NodeViews. Authored inline in the one ProseMirror
 * doc: the prompt + item cards are editable text; the author drags item cards
 * between category buckets with shuffle (each draggable card gets a shuffle
 * handle automatically) to set the grouping answer key. `...props` MUST be
 * spread onto the outer element of each view so the shuffle grid classes the
 * plugin decorates onto `cat` land on the DOM.
 *
 *   CatView         — block chrome: the kanban content (prompt + category
 *                     buckets laid out as columns) + an "Add category" button.
 *   CatPromptView   — the question stem (a block container, like MC/FB).
 *   CatCategoryView — one bucket: an editable name, the item cards, "Add item",
 *                     and a delete button.
 *   CatItemView     — one draggable item card + a delete button.
 */

import {
  useEditorEventCallback,
  useEditorState,
  type NodeViewComponentProps,
} from "@handlewithcare/react-prosemirror";
import { Trash } from "@phosphor-icons/react";
import type { Node as PmNode } from "prosemirror-model";
import { useEffect, useRef, useState } from "react";

import { useItemBuilderTools } from "../shared/blockTools";
import { newId } from "../shared/ids";
import {
  CAT_CATEGORY_NODE,
  CAT_ITEM_NODE,
} from "./schema";

function injectedClass(props: object): string {
  return (props as { className?: string }).className ?? "";
}

export function CatView({
  nodeProps,
  ref,
  children,
  ...props
}: NodeViewComponentProps) {
  const { node, getPos, contentDOMRef } = nodeProps;

  const addCategory = useEditorEventCallback((view) => {
    if (!view) return;
    const pos = getPos();
    if (pos == null) return;
    const categoryType = view.state.schema.nodes[CAT_CATEGORY_NODE];
    const itemType = view.state.schema.nodes[CAT_ITEM_NODE];
    if (!categoryType || !itemType) return;
    // Seed the bucket with one card so it has a grabbable starting point (an
    // empty bucket is valid, but a card makes it immediately editable/draggable).
    const category = categoryType.create({ categoryId: newId("cat"), name: "" }, [
      itemType.create({ cardId: newId("card") }, view.state.schema.text("Item")),
    ]);
    const endOfContent = pos + node.nodeSize - 1;
    view.dispatch(view.state.tr.insert(endOfContent, category).scrollIntoView());
  });

  const className = ["pp-cat", injectedClass(props)].filter(Boolean).join(" ");
  // Mirror the completer's presentation in the builder: "grid" lays the buckets
  // out as loose cards, "matrix" connects them into one table (see CSS). The
  // authoring is identical either way — `data-display` only drives layout.
  const display = (node.attrs["display"] as string) === "matrix" ? "matrix" : "grid";

  return (
    <div ref={ref} {...props} className={className} data-display={display}>
      {/* Identity comes from the shuffle handle pill + block menu; no baked-in
          label. Display mode + points live in the block menu (SettingsForm). */}
      <div ref={contentDOMRef} className="pp-cat-content">
        {children}
      </div>
      <button
        type="button"
        contentEditable={false}
        onMouseDown={(e) => e.preventDefault()}
        onClick={addCategory}
        className="pp-cat-add"
      >
        + Add category
      </button>
    </div>
  );
}

export function CatPromptView({
  nodeProps,
  ref,
  children,
  ...props
}: NodeViewComponentProps) {
  // The stem is a block container: it renders its child blocks (a paragraph by
  // default) and offers "+ Add to question" so the author can drop in images,
  // audio, headings, etc. The add control is injected by the page builder.
  const tools = useItemBuilderTools();
  const className = ["pp-cat-prompt-wrapper", injectedClass(props)]
    .filter(Boolean)
    .join(" ");
  return (
    <div ref={ref} {...props} className={className}>
      <div ref={nodeProps.contentDOMRef} className="pp-cat-prompt">
        {children}
      </div>
      {tools && (
        <tools.AddContentBlock
          getContainerPos={nodeProps.getPos}
          className="pp-cat-add pp-cat-add--stem"
          label="Add to question"
        />
      )}
    </div>
  );
}

export function CatCategoryView({
  nodeProps,
  ref,
  children,
  ...props
}: NodeViewComponentProps) {
  const { node, getPos } = nodeProps;
  const name = (node.attrs["name"] as string) ?? "";

  // Local draft for the name input so committing doesn't re-render the field
  // mid-keystroke (which would fight the cursor). Commit on blur / Enter; sync
  // back from the doc only while unfocused (covers undo/redo + external edits).
  const [draft, setDraft] = useState(name);
  const focusedRef = useRef(false);
  useEffect(() => {
    if (!focusedRef.current) setDraft(name);
  }, [name]);

  // Guard delete: a question needs ≥1 category (schema `cat_category+`).
  const editorState = useEditorState();
  let canDelete = false;
  const pos = getPos();
  if (editorState && pos != null) {
    const parent = editorState.doc.resolve(pos).parent;
    let count = 0;
    parent.forEach((c: PmNode) => {
      if (c.type.name === CAT_CATEGORY_NODE) count += 1;
    });
    canDelete = count > 1;
  }

  const commitName = useEditorEventCallback((view, value: string) => {
    if (!view) return;
    const p = getPos();
    if (p == null) return;
    view.dispatch(view.state.tr.setNodeAttribute(p, "name", value));
  });

  const addItem = useEditorEventCallback((view) => {
    if (!view) return;
    const p = getPos();
    if (p == null) return;
    const itemType = view.state.schema.nodes[CAT_ITEM_NODE];
    if (!itemType) return;
    const endOfContent = p + node.nodeSize - 1;
    const item = itemType.create(
      { cardId: newId("card") },
      view.state.schema.text("Item"),
    );
    view.dispatch(view.state.tr.insert(endOfContent, item).scrollIntoView());
  });

  const deleteCategory = useEditorEventCallback((view) => {
    if (!view) return;
    const p = getPos();
    if (p == null) return;
    if (!canDelete) return;
    view.dispatch(view.state.tr.delete(p, p + node.nodeSize));
  });

  const className = ["pp-cat-category", injectedClass(props)]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={ref} {...props} className={className}>
      <div className="pp-cat-category-head" contentEditable={false}>
        <input
          type="text"
          className="pp-cat-category-name"
          placeholder="Category"
          value={draft}
          onFocus={() => (focusedRef.current = true)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            focusedRef.current = false;
            if (draft !== name) commitName(draft);
          }}
          onKeyDown={(e) => {
            // Keep PM's keymap (Backspace deletes the node, Enter splits, …)
            // out of the name field.
            e.stopPropagation();
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={deleteCategory}
          disabled={!canDelete}
          className="pp-cat-category-delete"
          aria-label="Delete category"
          title={
            canDelete ? "Delete category" : "A question needs at least one category"
          }
        >
          <Trash size={14} weight="bold" />
        </button>
      </div>
      <div ref={nodeProps.contentDOMRef} className="pp-cat-category-items">
        {children}
      </div>
      <button
        type="button"
        contentEditable={false}
        onMouseDown={(e) => e.preventDefault()}
        onClick={addItem}
        className="pp-cat-add pp-cat-add--item"
      >
        + Add item
      </button>
    </div>
  );
}

export function CatItemView({
  nodeProps,
  ref,
  children,
  ...props
}: NodeViewComponentProps) {
  const { node, getPos } = nodeProps;

  const deleteItem = useEditorEventCallback((view) => {
    if (!view) return;
    const p = getPos();
    if (p == null) return;
    view.dispatch(view.state.tr.delete(p, p + node.nodeSize));
  });

  const className = ["pp-cat-item", injectedClass(props)]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={ref} {...props} className={className}>
      <div ref={nodeProps.contentDOMRef} className="pp-cat-item-text">
        {children}
      </div>
      <button
        type="button"
        contentEditable={false}
        onMouseDown={(e) => e.preventDefault()}
        onClick={deleteItem}
        className="pp-cat-item-delete"
        aria-label="Delete item"
        title="Delete item"
      >
        <Trash size={12} weight="bold" />
      </button>
    </div>
  );
}
