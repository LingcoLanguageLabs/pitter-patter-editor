/**
 * Floating popover that shows settings for the block under the
 * current selection — paragraph alignment, button variant, image
 * source, etc. Modelled on pagy's `panels/block-settings.tsx`:
 * a single popover that branches by node type into the right form.
 *
 * How it tracks the active block:
 *
 *   • Which block is "active" is owned by `blockHighlightPlugin` — an
 *     explicit, click-driven selection (pagy's `selectedBlock` model)
 *     that clears on gutter/outside clicks, Escape, and drag. We read
 *     its `activePos` and show the toolbar when that block's type has a
 *     form registered in `BLOCK_FORMS`.
 *   • Re-resolves the active block's DOM via `view.nodeDOM(pos)`,
 *     and feeds that to @floating-ui/react as the reference element
 *     so the popover stays glued to the right side of the block
 *     through scroll + resize.
 *
 * Updates are applied via `view.dispatch(tr.setNodeAttribute(...))`,
 * which writes immediately. No save button — same model as pagy.
 */

"use client";

import {
  autoUpdate,
  flip,
  offset,
  shift,
  useFloating,
} from "@floating-ui/react";
import {
  useEditorEffect,
  useEditorEventCallback,
  useEditorState,
} from "@handlewithcare/react-prosemirror";
import { CaretDown, Check, Copy, Trash } from "@phosphor-icons/react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { Node as PmNode } from "prosemirror-model";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import {
  getActiveBlockPos,
  isBlockResizing,
  isQuietSelection,
} from "../blockHighlightPlugin";
import { canHaveTopMargin } from "../BlockMarginHandle";
import { blockMarginValue, CONTAINER_DEFAULT_MARGIN } from "../spacing";

import { BLOCK_FORMS, BLOCK_TITLES, type ActiveBlock } from "./forms";
import { SpacingSection } from "./SpacingSection";
import {
  convertBlockType,
  isCurrentType,
  typeOptionsFor,
  type TypeOption,
} from "./typeOptions";

export function BlockSettings() {
  const editorState = useEditorState();
  // The active block is the explicit, click-driven selection owned by
  // `blockHighlightPlugin`. Show the toolbar when it points at a block
  // whose type has a settings form — unless the selection is "quiet"
  // (made by right-click): the context menu owns that interaction.
  const active = useMemo<ActiveBlock | null>(() => {
    const pos = getActiveBlockPos(editorState);
    if (pos == null || isQuietSelection(editorState)) return null;
    const node = editorState.doc.nodeAt(pos);
    if (!node || !(node.type.name in BLOCK_FORMS)) return null;
    return { pos, node, typeName: node.type.name as keyof typeof BLOCK_FORMS };
  }, [editorState]);

  // Hide the toolbar while resizing (the ring stays) — pagy suppresses
  // its popover the same way via `resizedBlock`.
  if (!active || isBlockResizing(editorState)) return null;
  return <BlockSettingsPopover active={active} />;
}

function BlockSettingsPopover({ active }: { active: ActiveBlock }) {
  const editorState = useEditorState();
  const [referenceEl, setReferenceEl] = useState<HTMLElement | null>(null);

  /** Resolve the active block's DOM node from the view. `useEditorEffect`
   *  is the right hook here: it waits until the PM view is mounted.
   *
   *  Deliberately NO dependency array — re-resolve after every render,
   *  pagy-style (its `section-controls.tsx` effect also has no deps and
   *  calls `toDOMNode` fresh each time). Anything that makes PM redraw
   *  the block — `setNodeMarkup` on a level/type switch (h3 → h1 is a
   *  new tag), decoration changes — replaces the DOM element, and a
   *  stale reference is detached: it measures 0,0 and the popover jumps
   *  to the viewport corner. `nodeDOM` is a cheap lookup and the
   *  setState is a no-op while the element is unchanged. */
  useEditorEffect((view) => {
    const dom = view.nodeDOM(active.pos);
    setReferenceEl(dom instanceof HTMLElement ? dom : null);
  });

  const { x, y, strategy, refs } = useFloating({
    placement: "right-start",
    middleware: [offset(20), flip(), shift({ padding: 16 })],
    whileElementsMounted: autoUpdate,
  });
  useEffect(() => {
    refs.setReference(referenceEl);
  }, [referenceEl, refs]);

  /** Commit attr updates back to the doc. */
  const setAttr = useEditorEventCallback(
    (view, name: string, value: unknown) => {
      view.dispatch(view.state.tr.setNodeAttribute(active.pos, name, value));
    },
  );

  /** Convert the block to another type (e.g. Paragraph → Heading 2).
   *  Shared with the context menu's "Turn into" — see typeOptions.ts. */
  const setType = useEditorEventCallback((view, opt: TypeOption) => {
    convertBlockType(view, active.pos, opt);
  });

  const duplicate = useEditorEventCallback((view) => {
    const insertAt = active.pos + active.node.nodeSize;
    view.dispatch(view.state.tr.insert(insertAt, active.node));
  });

  const remove = useEditorEventCallback((view) => {
    view.dispatch(
      view.state.tr.delete(active.pos, active.pos + active.node.nodeSize),
    );
  });

  const Form = BLOCK_FORMS[active.typeName];

  return createPortal(
    <div
      ref={refs.setFloating}
      className="pb-block-settings"
      style={{ position: strategy, top: y ?? 0, left: x ?? 0 }}
    >
      <header className="pb-block-settings-header">
        <BlockTypeSwitcher node={active.node} onConvert={setType} />
        <div className="pb-block-settings-actions">
          <button
            type="button"
            className="pb-block-settings-icon"
            onClick={duplicate}
            aria-label="Duplicate block"
          >
            <Copy size={14} weight="regular" />
          </button>
          <button
            type="button"
            className="pb-block-settings-icon"
            onClick={remove}
            aria-label="Delete block"
          >
            <Trash size={14} weight="regular" />
          </button>
        </div>
      </header>
      <div className="pb-block-settings-body">
        <Form active={active} setAttr={setAttr} />
        {/* Spacing group — block top-margin, wired to the same attr/snap scale
            as the canvas handle. `autoPx` is what Auto resolves to here: a
            container child's default rhythm (so Auto fills the gap), else 0. */}
        {canHaveTopMargin(editorState, active.pos) && (
          <SpacingSection
            key={active.pos}
            margin={{
              value: blockMarginValue(active.node.attrs),
              autoPx:
                editorState.doc.resolve(active.pos).parent.type.name === "container"
                  ? CONTAINER_DEFAULT_MARGIN
                  : 0,
              onChange: (v) => setAttr("margin", v),
            }}
          />
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Panel-header title that doubles as a type converter for blocks that
 *  can change type (text blocks: Paragraph ↔ Heading 1–4). Other blocks
 *  render a plain title. */
function BlockTypeSwitcher({
  node,
  onConvert,
}: {
  node: PmNode;
  onConvert: (opt: TypeOption) => void;
}) {
  const options = typeOptionsFor(node);
  const currentLabel =
    options?.find((o) => isCurrentType(node, o))?.label ??
    BLOCK_TITLES[node.type.name as keyof typeof BLOCK_FORMS] ??
    node.type.name;

  if (!options) {
    return <span className="pb-block-settings-title">{currentLabel}</span>;
  }

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <button type="button" className="pb-block-settings-type">
          <span>{currentLabel}</span>
          <CaretDown size={12} weight="bold" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="pb-type-menu"
          align="start"
          sideOffset={6}
        >
          {options.map((opt) => {
            const current = isCurrentType(node, opt);
            return (
              <DropdownMenu.Item
                key={opt.label}
                className="pb-type-menu-item"
                data-active={current || undefined}
                onSelect={(event) => {
                  event.preventDefault();
                  onConvert(opt);
                }}
              >
                <span>{opt.label}</span>
                {current && <Check size={14} weight="bold" />}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
