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
import { NodeSelection, TextSelection } from "prosemirror-state";

import { canHaveTopMargin, isHorizontalStackChild } from "../BlockMarginHandle";
import { getItemDefinition, isInlineItemNode, isItemType } from "../items/registry";
import { blockMarginValue, CONTAINER_DEFAULT_MARGIN } from "../spacing";

import { AttributesSection } from "./AttributesSection";
import { BLOCK_FORMS, BLOCK_TITLES, type ActiveBlock } from "./forms";
import { SpacingSection } from "./SpacingSection";
import { StylesSection } from "./StylesSection";
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
    // An inline item node (e.g. a Fill Blanks `blank`) owns its own settings
    // popover — don't also show the enclosing block's menu.
    const sel = editorState.selection;
    if (sel instanceof NodeSelection && isInlineItemNode(sel.node.type.name)) {
      return null;
    }
    const pos = getActiveBlockPos(editorState);
    if (pos == null || isQuietSelection(editorState)) return null;
    const node = editorState.doc.nodeAt(pos);
    if (!node) return null;
    // Show for built-in block types AND registered learning-item types.
    if (!(node.type.name in BLOCK_FORMS) && !isItemType(node.type.name)) {
      return null;
    }
    return { pos, node, typeName: node.type.name };
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

  // The block's sole content child — today just the image's `image_caption`,
  // always at `pos + 1` since that content model matches exactly one node.
  // Three helpers for the Caption control in `ImageForm`: set an attr on it
  // (alignment), focus a cursor inside it (the panel's "+ Add caption"), and
  // clear its text (the panel's remove) — forms.tsx stays PM-import-free.
  const captionChildPos = active.pos + 1;

  const setCaptionAttr = useEditorEventCallback(
    (view, name: string, value: unknown) => {
      view.dispatch(
        view.state.tr.setNodeAttribute(captionChildPos, name, value),
      );
    },
  );

  const focusCaption = useEditorEventCallback((view) => {
    const pos = captionChildPos + 1;
    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)),
    );
    view.focus();
  });

  const clearCaption = useEditorEventCallback((view) => {
    const captionNode = active.node.firstChild;
    if (!captionNode) return;
    const from = captionChildPos + 1;
    view.dispatch(view.state.tr.delete(from, from + captionNode.content.size));
  });

  // Item types provide their settings panel via the registry (self-contained);
  // built-in blocks use the central BLOCK_FORMS map.
  const itemDef = getItemDefinition(active.node.type.name);
  const ItemForm = itemDef?.SettingsForm;
  const BuiltinForm = ItemForm
    ? undefined
    : BLOCK_FORMS[active.typeName as keyof typeof BLOCK_FORMS];

  // Width clamps are image-only for now (keeping a floating image from
  // overlapping content on a narrow section is the case they're for). Every
  // block still carries the shared minW/maxW attrs; we just don't surface the
  // control elsewhere.
  const showWidthLimits =
    active.node.type.name === "image" && "minW" in active.node.attrs;

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
        {ItemForm ? (
          <ItemForm node={active.node} setAttr={setAttr} />
        ) : BuiltinForm ? (
          <BuiltinForm
            active={active}
            setAttr={setAttr}
            setCaptionAttr={setCaptionAttr}
            focusCaption={focusCaption}
            clearCaption={clearCaption}
          />
        ) : null}
        {/* Attributes group — semantic attrs the block carries: Language
            (text-bearing blocks), a custom Placeholder (text prompt) + Alt text
            (images). Shown when the block has any of them; each row renders only
            when its attr is present. */}
        {(active.node.attrs["lang"] !== undefined ||
          active.node.attrs["placeholder"] !== undefined ||
          active.node.attrs["alt"] !== undefined) && (
          <AttributesSection
            key={active.pos}
            language={
              active.node.attrs["lang"] !== undefined
                ? {
                    value: (active.node.attrs["lang"] as string) || "",
                    onChange: (v) => setAttr("lang", v),
                  }
                : undefined
            }
            placeholder={
              active.node.attrs["placeholder"] !== undefined
                ? {
                    value: (active.node.attrs["placeholder"] as string) || "",
                    onChange: (v) => setAttr("placeholder", v),
                  }
                : undefined
            }
            alt={
              active.node.attrs["alt"] !== undefined
                ? {
                    value: (active.node.attrs["alt"] as string) || "",
                    onChange: (v) => setAttr("alt", v),
                  }
                : undefined
            }
          />
        )}
        {/* Styles group — opacity (visual blocks whose schema carries the
            `opacity` attr) plus the px width clamps (image only, for now). Both
            opt-in behind "+"; the section shows when the block carries either, so
            it never renders an empty heading. */}
        {(active.node.attrs["opacity"] !== undefined || showWidthLimits) && (
          <StylesSection
            key={active.pos}
            opacity={
              active.node.attrs["opacity"] !== undefined
                ? {
                    value:
                      typeof active.node.attrs["opacity"] === "number"
                        ? (active.node.attrs["opacity"] as number)
                        : null,
                    onChange: (v) => setAttr("opacity", v),
                  }
                : undefined
            }
            widthLimits={
              showWidthLimits
                ? {
                    minW: (active.node.attrs["minW"] as number) ?? 0,
                    maxW: (active.node.attrs["maxW"] as number) ?? 0,
                    onChange: (name, v) => setAttr(name, v),
                  }
                : undefined
            }
          />
        )}
        {/* Spacing group — the block's leading margin, wired to the same attr/
            snap scale as the canvas handle. `autoPx` is what Auto resolves to: a
            container child's default rhythm (so Auto fills the gap), else 0.
            `axis` orients it to the stack — a horizontal container's child shows
            a left margin, matching its canvas band. */}
        {canHaveTopMargin(editorState, active.pos) && (
          <SpacingSection
            key={active.pos}
            margin={{
              value: blockMarginValue(active.node.attrs),
              autoPx:
                editorState.doc.resolve(active.pos).parent.type.name === "container"
                  ? CONTAINER_DEFAULT_MARGIN
                  : 0,
              axis: isHorizontalStackChild(editorState, active.pos)
                ? "horizontal"
                : "vertical",
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
    getItemDefinition(node.type.name)?.catalog.label ??
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
