/**
 * React widget rendered into each section by `sectionChromePlugin`.
 * Carries the "+ Add block" / "+ Add section" affordance pills.
 *
 * The widget is mounted via a ProseMirror widget decoration, which
 * means PM treats it as opaque — it's not part of the doc model and
 * isn't visited by coordinate walks like `posAtCoords`. That keeps
 * shuffle's drop-target math clean.
 *
 * The widget receives `getPos()` from PM (the section's
 * end-of-content position). `findEnclosingSection` walks back from
 * there to the section node so insertion targets stay correct after
 * any doc edits.
 */

"use client";

import { Plus } from "@phosphor-icons/react";
import {
  useEditorEventCallback,
  type WidgetViewComponentProps,
} from "@handlewithcare/react-prosemirror";
import type { EditorView } from "prosemirror-view";
import { forwardRef } from "react";

import { BlockPicker } from "./blocks/BlockPicker";
import type { BlockCatalogEntry } from "./blocks/catalog";
import { createBlockNode } from "./blocks/createBlock";
import { usePageBuilderStore } from "./store";

interface SectionInfo {
  /** Position of the section node itself in the doc. */
  pos: number;
  /** Total node size, including the open + close tokens. */
  nodeSize: number;
}

/** Walks back from `widgetPos` (end-of-content for its section) to
 *  the enclosing section node. */
function findEnclosingSection(
  view: EditorView,
  widgetPos: number,
): SectionInfo | null {
  const $pos = view.state.doc.resolve(widgetPos);
  for (let depth = $pos.depth; depth >= 0; depth--) {
    const node = $pos.node(depth);
    if (node.type.name !== "section") continue;
    const start = depth === 0 ? 0 : $pos.before(depth);
    return { pos: start, nodeSize: node.nodeSize };
  }
  return null;
}

export const SectionChromeWidget = forwardRef<
  HTMLDivElement,
  WidgetViewComponentProps
>(function SectionChromeWidget({ getPos, widget: _widget, ...rest }, ref) {
  const isDragging = usePageBuilderStore((s) => s.isDragging);

  /** Insert a block from the catalog into this section (or after it,
   *  if the entry is itself a section). */
  const insertBlock = useEditorEventCallback(
    (view, entry: BlockCatalogEntry) => {
      const info = findEnclosingSection(view, getPos());
      if (!info) return;
      const node = createBlockNode(view.state.schema, entry);
      const insertAt =
        entry.type === "section"
          ? // Sections go *after* this section.
            info.pos + info.nodeSize
          : // Everything else goes at the end of this section's content.
            info.pos + 1 + (view.state.doc.nodeAt(info.pos)?.content.size ?? 0);
      view.dispatch(view.state.tr.insert(insertAt, node));
      view.focus();
    },
  );

  /** Insert a new section either before or after this one. */
  const addSection = useEditorEventCallback(
    (view, where: "before" | "after") => {
      const info = findEnclosingSection(view, getPos());
      if (!info) return;
      const sectionType = view.state.schema.nodes["section"];
      const paragraph = view.state.schema.nodes["paragraph"];
      if (!sectionType || !paragraph) return;
      const insertAt = where === "before" ? info.pos : info.pos + info.nodeSize;
      const newSection = sectionType.create(
        null,
        paragraph.create(null, view.state.schema.text("New section")),
      );
      view.dispatch(view.state.tr.insert(insertAt, newSection));
      view.focus();
    },
  );

  return (
    <div
      ref={ref}
      {...rest}
      className="pb-section-chrome"
      contentEditable={false}
      data-dragging={isDragging || undefined}
    >
      <BlockPicker
        side="bottom"
        onPick={insertBlock}
        trigger={
          <button type="button" className="pb-add-block">
            <Plus size={12} weight="bold" />
            <span>Add block</span>
          </button>
        }
      />
      <button
        type="button"
        className="pb-add-section pb-add-section--top"
        onClick={() => addSection("before")}
      >
        <Plus size={12} weight="bold" />
        <span>Add section</span>
      </button>
      <button
        type="button"
        className="pb-add-section pb-add-section--bottom"
        onClick={() => addSection("after")}
      >
        <Plus size={12} weight="bold" />
        <span>Add section</span>
      </button>
    </div>
  );
});
