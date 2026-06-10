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
  keepBlockSelected,
} from "../blockHighlightPlugin";
import { PARAGRAPH_DEFAULT_SIZE, defaultHeadingSize } from "../schema";

import { BLOCK_FORMS, BLOCK_TITLES, type ActiveBlock } from "./forms";

/** Block types you can convert between, grouped by compatible content.
 *  Mirrors pagy's panel-header type picker (paragraph ↔ heading-N).
 *  Container ↔ Card would go here too once a `card` node exists. */
interface TypeOption {
  label: string;
  typeName: string;
  attrs?: Record<string, unknown>;
  /** Attrs stamped on convert but NOT part of the option's identity —
   *  a Heading 1 the user resized to "m" is still "Heading 1". Pagy
   *  does the same: switching text type also sets
   *  `size: defaultSizeForBlockType(type)`. */
  defaults?: Record<string, unknown>;
}
const TEXT_TYPE_OPTIONS: readonly TypeOption[] = [
  {
    label: "Paragraph",
    typeName: "paragraph",
    defaults: { size: PARAGRAPH_DEFAULT_SIZE },
  },
  ...([1, 2, 3, 4] as const).map((level) => ({
    label: `Heading ${level}`,
    typeName: "heading",
    attrs: { level },
    defaults: { size: defaultHeadingSize(level) },
  })),
];
const LAYOUT_TYPE_OPTIONS: readonly TypeOption[] = [
  { label: "Container", typeName: "container" },
  { label: "Card", typeName: "card" },
];

/** Options available for a given block, or null if it can't convert. */
function typeOptionsFor(node: PmNode): readonly TypeOption[] | null {
  const name = node.type.name;
  if (name === "paragraph" || name === "heading") return TEXT_TYPE_OPTIONS;
  if (name === "container" || name === "card") return LAYOUT_TYPE_OPTIONS;
  return null;
}

function isCurrentType(node: PmNode, opt: TypeOption): boolean {
  if (node.type.name !== opt.typeName) return false;
  if (!opt.attrs) return true;
  return Object.entries(opt.attrs).every(([k, v]) => node.attrs[k] === v);
}

export function BlockSettings() {
  const editorState = useEditorState();
  // The active block is the explicit, click-driven selection owned by
  // `blockHighlightPlugin`. Show the toolbar when it points at a block
  // whose type has a settings form.
  const active = useMemo<ActiveBlock | null>(() => {
    const pos = getActiveBlockPos(editorState);
    if (pos == null) return null;
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
   *  Carries over whatever attrs the target type also declares (align,
   *  shuffle columns) so layout/placement survive the swap, then applies
   *  the option's defaults (e.g. the heading level's default size) and
   *  identity attrs (e.g. level). */
  const setType = useEditorEventCallback((view, opt: TypeOption) => {
    const type = view.state.schema.nodes[opt.typeName];
    const node = view.state.doc.nodeAt(active.pos);
    if (!type || !node) return;
    const allowed = type.spec.attrs ?? {};
    const merged: Record<string, unknown> = {
      ...node.attrs,
      ...opt.defaults,
      ...opt.attrs,
    };
    const attrs = Object.fromEntries(
      Object.entries(merged).filter(([k]) => k in allowed),
    );
    // setNodeMarkup's ReplaceAroundStep maps the block's position as
    // "deleted", which would clear the explicit selection and close this
    // popover mid-convert — re-assert it on the same transaction.
    view.dispatch(
      keepBlockSelected(
        view.state.tr.setNodeMarkup(active.pos, type, attrs),
        active.pos,
      ),
    );
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
