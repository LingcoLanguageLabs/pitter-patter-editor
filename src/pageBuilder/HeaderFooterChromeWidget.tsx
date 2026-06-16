/**
 * Chrome for the `header` and `footer` bars — the leaner cousin of
 * `SectionChromeWidget`. Mounted by `sectionChromePlugin` as a PM widget
 * decoration at the bar's end-of-content position (so it's opaque to shuffle's
 * `posAtCoords`, like the section chrome).
 *
 * The toolbar is intentionally lean — "+ Add block", the settings gear, and a
 * delete. WHERE the bar lives (Global / This page / Hidden) is set in the
 * settings popover's Scope section (`BarScopeField`), not here.
 *
 * Delete is scope-aware: a doc-level MASTER deletes site-wide; a page OVERRIDE
 * just drops back to inheriting the global. The bar is recognised as a master
 * when it's a direct child of the doc (`isGlobalBarPos`).
 */

"use client";

import { GearSix, Plus, Trash } from "@phosphor-icons/react";
import {
  useEditorEventCallback,
  useEditorState,
  type WidgetViewComponentProps,
} from "@handlewithcare/react-prosemirror";
import { forwardRef, useState } from "react";

import { Tooltip, TooltipProvider } from "../editor/menu";

import { BlockPicker } from "./blocks/BlockPicker";
import { BLOCK_CATALOG, type BlockCatalogEntry } from "./blocks/catalog";
import { createBlockNode } from "./blocks/createBlock";
import { FooterSettings } from "./FooterSettings";
import { isGlobalBarPos, resetBarToGlobal, type BarKind } from "./headerFooter";
import { HeaderSettings } from "./HeaderSettings";
import { SectionSpacingBands } from "./SectionSpacingBands";
import { findEnclosingOfType } from "./sectionUtils";
import { usePageBuilderStore } from "./store";

const HF_TYPES = ["header", "footer"] as const;

// Sections aren't valid inside a bar (bar content is `block+`), so drop that
// catalog entry — every other block is fine.
const BAR_CATALOG: BlockCatalogEntry[] = BLOCK_CATALOG.filter(
  (e) => e.type !== "section",
);

export const HeaderFooterChromeWidget = forwardRef<
  HTMLDivElement,
  WidgetViewComponentProps
>(function HeaderFooterChromeWidget({ getPos, widget: _widget, ...rest }, ref) {
  const isDragging = usePageBuilderStore((s) => s.isDragging);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [gearEl, setGearEl] = useState<HTMLButtonElement | null>(null);

  const editorState = useEditorState();
  const info = findEnclosingOfType(editorState, getPos(), HF_TYPES);
  const kind: BarKind = info?.node.type.name === "footer" ? "footer" : "header";
  const label = kind === "footer" ? "Footer" : "Header";
  const lower = label.toLowerCase();
  // Master (doc-level) vs page override — drives the delete affordance only.
  const isGlobal = info ? isGlobalBarPos(editorState.doc, info.pos) : true;

  /** Insert a block at the end of this bar's content. */
  const insertBlock = useEditorEventCallback(
    (view, entry: BlockCatalogEntry) => {
      const at = findEnclosingOfType(view.state, getPos(), HF_TYPES);
      if (!at) return;
      const node = createBlockNode(view.state.schema, entry);
      const insertAt =
        at.pos + 1 + (view.state.doc.nodeAt(at.pos)?.content.size ?? 0);
      view.dispatch(view.state.tr.insert(insertAt, node));
      view.focus();
    },
  );

  /** Serialized node JSON so picker items can also be dragged in (shuffle's
   *  `data-shuffle-inflatable`), matching the section chrome. */
  const inflatableJSON = (entry: BlockCatalogEntry): string | undefined => {
    try {
      return JSON.stringify(createBlockNode(editorState.schema, entry).toJSON());
    } catch {
      return undefined;
    }
  };

  /** Master → delete site-wide; override → drop back to the global. */
  const remove = useEditorEventCallback((view) => {
    const at = findEnclosingOfType(view.state, getPos(), HF_TYPES);
    if (!at) return;
    if (isGlobalBarPos(view.state.doc, at.pos)) {
      view.dispatch(view.state.tr.delete(at.pos, at.pos + at.nodeSize));
    } else {
      resetBarToGlobal(view, at.node.type.name as BarKind);
    }
  });

  return (
    <div
      ref={ref}
      {...rest}
      className={`pb-section-chrome${isGlobal ? " -global" : ""}`}
      contentEditable={false}
      data-dragging={isDragging || undefined}
    >
      {/* On-canvas size drag — both bars drag their symmetric vertical padding
          via the hatched top/bottom bands, exactly like a section. */}
      <SectionSpacingBands getPos={getPos} />

      <div className="pb-section-bar">
        <BlockPicker
          side="bottom"
          catalog={BAR_CATALOG}
          onPick={insertBlock}
          inflatableJSON={inflatableJSON}
          trigger={
            <button type="button" className="pb-add-block">
              <Plus size={12} weight="bold" />
              <span>Add block</span>
            </button>
          }
        />
        <TooltipProvider delayDuration={200} skipDelayDuration={300}>
          <div className="pb-section-toolbar">
            <Tooltip label={`${label} settings`}>
              <button
                type="button"
                className="pb-section-tool"
                ref={setGearEl}
                data-state={settingsOpen ? "open" : undefined}
                onClick={() => setSettingsOpen((open) => !open)}
                aria-label={`${label} settings`}
              >
                <GearSix size={16} weight="regular" />
              </button>
            </Tooltip>
            <Tooltip
              label={isGlobal ? `Delete site ${lower}` : `Reset to global ${lower}`}
            >
              <button
                type="button"
                className="pb-section-tool -destructive"
                onClick={remove}
                aria-label={isGlobal ? `Delete site ${lower}` : `Reset ${lower} to global`}
              >
                <Trash size={16} weight="regular" />
              </button>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>

      {settingsOpen &&
        (kind === "header" ? (
          <HeaderSettings
            anchor={gearEl}
            getPos={getPos}
            onClose={() => setSettingsOpen(false)}
          />
        ) : (
          <FooterSettings
            anchor={gearEl}
            getPos={getPos}
            onClose={() => setSettingsOpen(false)}
          />
        ))}
    </div>
  );
});
