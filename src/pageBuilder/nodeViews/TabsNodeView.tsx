/**
 * Tabs — builder NodeViews. In the builder the tabs are shown STACKED (each
 * label above its panel) so the author can edit every panel directly; the runtime
 * renders the real tab strip + active panel (the established builder/runtime
 * divergence). `{...props}` MUST land on each view's outer element for shuffle.
 *
 *   TabsView      — block chrome: the tabs + an "Add tab" button.
 *   TabView       — one tab (label + panel) + a delete button.
 *   TabLabelView  — the editable label (styled as a tab chip).
 *   TabPanelView  — the editable panel ("put anything", + "Add to panel").
 */

import {
  useEditorEventCallback,
  useEditorState,
  type NodeViewComponentProps,
} from "@handlewithcare/react-prosemirror";
import { Trash } from "@phosphor-icons/react";
import type { Node as PmNode } from "prosemirror-model";

import { useItemBuilderTools } from "../items/shared/blockTools";
import { TAB_NODE } from "../blocks/tabs";

function injectedClass(props: object): string {
  return (props as { className?: string }).className ?? "";
}

export function TabsView({
  nodeProps,
  ref,
  children,
  ...props
}: NodeViewComponentProps) {
  const { node, getPos, contentDOMRef } = nodeProps;
  const addTab = useEditorEventCallback((view) => {
    if (!view) return;
    const pos = getPos();
    if (pos == null) return;
    const tabType = view.state.schema.nodes[TAB_NODE];
    const newTab = tabType?.createAndFill();
    if (!newTab) return;
    const endOfContent = pos + node.nodeSize - 1;
    view.dispatch(view.state.tr.insert(endOfContent, newTab).scrollIntoView());
  });
  const className = ["pb-tabs", injectedClass(props)].filter(Boolean).join(" ");
  return (
    <div ref={ref} {...props} className={className} data-node-type="tabs">
      <div ref={contentDOMRef} className="pb-tabs-items">
        {children}
      </div>
      <button
        type="button"
        contentEditable={false}
        onMouseDown={(e) => e.preventDefault()}
        onClick={addTab}
        className="pb-block-add"
      >
        + Add tab
      </button>
    </div>
  );
}

export function TabView({
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
      if (c.type.name === TAB_NODE) count += 1;
    });
    canDelete = count > 1;
  }

  const deleteTab = useEditorEventCallback((view) => {
    if (!view) return;
    const p = getPos();
    if (p == null) return;
    view.dispatch(view.state.tr.delete(p, p + node.nodeSize));
  });

  const className = ["pb-tab", injectedClass(props)].filter(Boolean).join(" ");
  return (
    <div ref={ref} {...props} className={className}>
      <div ref={nodeProps.contentDOMRef} className="pb-tab-content">
        {children}
      </div>
      <button
        type="button"
        contentEditable={false}
        onMouseDown={(e) => e.preventDefault()}
        onClick={deleteTab}
        disabled={!canDelete}
        className="pb-tab-delete"
        aria-label="Delete tab"
        title={canDelete ? "Delete tab" : "Tabs need at least one tab"}
      >
        <Trash size={14} weight="bold" />
      </button>
    </div>
  );
}

export function TabLabelView({
  nodeProps,
  ref,
  children,
  ...props
}: NodeViewComponentProps) {
  const className = ["pb-tab-label", injectedClass(props)]
    .filter(Boolean)
    .join(" ");
  return (
    <div ref={ref} {...props} className={className}>
      <div ref={nodeProps.contentDOMRef} className="pb-tab-label-text">
        {children}
      </div>
    </div>
  );
}

export function TabPanelView({
  nodeProps,
  ref,
  children,
  ...props
}: NodeViewComponentProps) {
  const tools = useItemBuilderTools();
  const className = ["pb-tab-panel", injectedClass(props)]
    .filter(Boolean)
    .join(" ");
  return (
    <div ref={ref} {...props} className={className}>
      <div ref={nodeProps.contentDOMRef} className="pb-tab-panel-content">
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
