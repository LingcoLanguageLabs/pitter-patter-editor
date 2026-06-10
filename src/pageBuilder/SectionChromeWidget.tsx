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

import {
  ArrowDown,
  ArrowUp,
  Copy,
  GearSix,
  Plus,
  Trash,
} from "@phosphor-icons/react";
import {
  useEditorEventCallback,
  useEditorState,
  type WidgetViewComponentProps,
} from "@handlewithcare/react-prosemirror";
import { forwardRef, useState } from "react";

import { Tooltip, TooltipProvider } from "../editor/menu";

import { BlockPicker } from "./blocks/BlockPicker";
import type { BlockCatalogEntry } from "./blocks/catalog";
import { createBlockNode } from "./blocks/createBlock";
import { SectionSettings } from "./SectionSettings";
import { findEnclosingSection } from "./sectionUtils";
import { usePageBuilderStore } from "./store";

export const SectionChromeWidget = forwardRef<
  HTMLDivElement,
  WidgetViewComponentProps
>(function SectionChromeWidget({ getPos, widget: _widget, ...rest }, ref) {
  const isDragging = usePageBuilderStore((s) => s.isDragging);
  // Section settings popover (pagy's gear panel), anchored to the gear.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [gearEl, setGearEl] = useState<HTMLButtonElement | null>(null);

  /** Insert a block from the catalog into this section (or after it,
   *  if the entry is itself a section). */
  const insertBlock = useEditorEventCallback(
    (view, entry: BlockCatalogEntry) => {
      const info = findEnclosingSection(view.state, getPos());
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

  // This section's position among the doc's sections, for gating the toolbar:
  // hide Move-up on the first, Move-down on the last, Delete when it's the only
  // one (doc.content is `section+`, so the last section can't be removed).
  const editorState = useEditorState();
  const sectionIndex = editorState.doc.resolve(getPos()).index(0);
  const sectionCount = editorState.doc.childCount;
  const isFirst = sectionIndex === 0;
  const isLast = sectionIndex === sectionCount - 1;
  const canDelete = sectionCount > 1;

  /** Move this section one slot up or down among its siblings. */
  const moveSection = useEditorEventCallback((view, dir: "up" | "down") => {
    const info = findEnclosingSection(view.state, getPos());
    if (!info) return;
    const { state } = view;
    const node = state.doc.nodeAt(info.pos);
    if (!node) return;
    const $pos = state.doc.resolve(info.pos);
    const index = $pos.index(0);
    if (dir === "up" && index === 0) return;
    if (dir === "down" && index === state.doc.childCount - 1) return;
    // Delete this section, then re-insert it on the far side of its neighbour.
    // The insert position is mapped through the delete so it stays valid.
    const target =
      dir === "up"
        ? $pos.posAtIndex(index - 1, 0) // before the previous section
        : info.pos + info.nodeSize + (state.doc.nodeAt(info.pos + info.nodeSize)?.nodeSize ?? 0); // after the next
    const tr = state.tr.delete(info.pos, info.pos + info.nodeSize);
    tr.insert(tr.mapping.map(target), node);
    view.dispatch(tr.scrollIntoView());
  });

  /** Insert a copy of this section directly after it. The copy drops
   *  the `htmlId` — an id names a unique anchor, so duplicating it is
   *  never right, and clearing here keeps ids unique by construction
   *  in the one flow that would silently copy them. */
  const duplicateSection = useEditorEventCallback((view) => {
    const info = findEnclosingSection(view.state, getPos());
    if (!info) return;
    const node = view.state.doc.nodeAt(info.pos);
    if (!node) return;
    const copy = node.type.create(
      { ...node.attrs, htmlId: "" },
      node.content,
      node.marks,
    );
    view.dispatch(view.state.tr.insert(info.pos + info.nodeSize, copy));
  });

  /** Remove this section (guarded so the doc always keeps one). */
  const deleteSection = useEditorEventCallback((view) => {
    const info = findEnclosingSection(view.state, getPos());
    if (!info || view.state.doc.childCount <= 1) return;
    view.dispatch(view.state.tr.delete(info.pos, info.pos + info.nodeSize));
  });

  /** Insert a new section either before or after this one. */
  const addSection = useEditorEventCallback(
    (view, where: "before" | "after") => {
      const info = findEnclosingSection(view.state, getPos());
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
      {/* Sticky top bar: "+ Add block" (left) and the section toolbar (right)
          ride the top of the section and stick to the scroll viewport while you
          scroll through a tall one — CSS `position: sticky`, bounded by the
          section, so it parks at the section's bottom rather than spilling into
          the next. */}
      <div className="pb-section-bar">
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
      <TooltipProvider delayDuration={200} skipDelayDuration={300}>
        <div className="pb-section-toolbar">
          {/* Gear first, like pagy's section toolbar. `data-state` makes
              the existing `:has([data-state="open"])` visibility rule
              keep the toolbar shown while the popover is open. */}
          <Tooltip label="Section settings">
            <button
              type="button"
              className="pb-section-tool"
              ref={setGearEl}
              data-state={settingsOpen ? "open" : undefined}
              onClick={() => setSettingsOpen((open) => !open)}
              aria-label="Section settings"
            >
              <GearSix size={16} weight="regular" />
            </button>
          </Tooltip>
          {!isFirst && (
            <Tooltip label="Move up">
              <button
                type="button"
                className="pb-section-tool"
                onClick={() => moveSection("up")}
                aria-label="Move section up"
              >
                <ArrowUp size={16} weight="regular" />
              </button>
            </Tooltip>
          )}
          {!isLast && (
            <Tooltip label="Move down">
              <button
                type="button"
                className="pb-section-tool"
                onClick={() => moveSection("down")}
                aria-label="Move section down"
              >
                <ArrowDown size={16} weight="regular" />
              </button>
            </Tooltip>
          )}
          <Tooltip label="Duplicate">
            <button
              type="button"
              className="pb-section-tool"
              onClick={duplicateSection}
              aria-label="Duplicate section"
            >
              <Copy size={16} weight="regular" />
            </button>
          </Tooltip>
          {canDelete && (
            <Tooltip label="Delete section">
              <button
                type="button"
                className="pb-section-tool -destructive"
                onClick={deleteSection}
                aria-label="Delete section"
              >
                <Trash size={16} weight="regular" />
              </button>
            </Tooltip>
          )}
        </div>
      </TooltipProvider>
      </div>

      {/* One "Add section" per gap, not two. Each section owns the button in
          the gap *above* it (`before`); on the 2nd+ section it straddles the
          boundary, centered between the two. The first sits inside its top; the
          last additionally owns an `after` button to append at the very end. */}
      <button
        type="button"
        className={`pb-add-section pb-add-section--before${isFirst ? "" : " -boundary"}`}
        onClick={() => addSection("before")}
      >
        <Plus size={12} weight="bold" />
        <span>Add section</span>
      </button>
      {isLast && (
        <button
          type="button"
          className="pb-add-section pb-add-section--after"
          onClick={() => addSection("after")}
        >
          <Plus size={12} weight="bold" />
          <span>Add section</span>
        </button>
      )}

      {settingsOpen && (
        <SectionSettings
          anchor={gearEl}
          getPos={getPos}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
});
