/**
 * Inline formatting toolbar — the floating pill that appears above a
 * text selection. Pagy's `inline-formatting-toolbar.tsx` translated to
 * our ProseMirror page builder:
 *
 *   • Type picker (Paragraph / Heading 1–4) — applies to every text
 *     block the selection touches, via `convertBlockTypes`.
 *   • Size picker (Extra small … Extra large) — same multi-block rule.
 *   • Align left/center/right.
 *   • Bold (suppressed when the selection touches a heading — pagy
 *     does the same), Italic, Strikethrough.
 *   • Theme-slot color picker (Default / Muted / Light / Primary /
 *     Secondary / Tertiary) on the `textColor` mark.
 *   • Link — applies an empty `link` mark and opens `LinkPopover`.
 *
 * Show/hide rules (pagy's, translated):
 *   • Visible only for a non-collapsed TextSelection with actual text.
 *   • Hidden when the selection touches a button block — the settings
 *     popover owns button styling/linking.
 *   • Hidden during a shuffle drag and while the link popover is open.
 *
 * The pill anchors above the DOM selection rect via floating-ui's
 * virtual-element API and stays mounted through hide so the same
 * fade+scale reveal as the section pills can play in both directions
 * (200ms in / 400ms out, overshoot curve — see page-builder.css).
 * `onMouseDown preventDefault` on the pill keeps clicks from stealing
 * the editor's DOM selection, so the marks always land on the text the
 * user can see highlighted.
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
import {
  CaretDown,
  Check,
  TextAlignCenter,
  TextAlignLeft,
  TextAlignRight,
} from "@phosphor-icons/react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { shufflePluginKey } from "@pitter-patter/shuffle";
import { toggleMark } from "prosemirror-commands";
import type { Node as PmNode } from "prosemirror-model";
import { TextSelection, type EditorState } from "prosemirror-state";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { isMarkActive } from "../editor/helpers";
import { Tooltip, TooltipProvider } from "../editor/menu";

import { isQuietSelection } from "./blockHighlightPlugin";
import {
  ALIGN_LABELS,
  SIZE_LABELS,
  TEXT_TYPE_OPTIONS,
  convertBlockTypes,
  isCurrentType,
  type TypeOption,
} from "./blockSettings/typeOptions";
import { LinkPopover, type LinkRange } from "./LinkPopover";
import {
  ALIGN_VALUES,
  PARAGRAPH_DEFAULT_SIZE,
  SIZE_VALUES,
  TEXT_COLOR_VALUES,
  defaultHeadingSize,
  type Align,
  type Size,
  type TextColor,
} from "./schema";

interface TextBlock {
  node: PmNode;
  pos: number;
}

/** Everything the toolbar body branches on, derived from one state —
 *  pagy's `selectionShape`. Null = toolbar hidden. */
interface SelectionShape {
  from: number;
  to: number;
  blocks: TextBlock[];
  /** "Paragraph" / "Heading 2" / "Multiple" (mixed run). */
  typeLabel: string;
  /** Effective size of the start block (pagy shows the start block's
   *  size as the trigger label). */
  size: Size;
  align: Align;
  anyHeading: boolean;
  activeColor: TextColor | null;
  linkActive: boolean;
}

/** Paragraph/heading blocks the range touches. Null when the range
 *  touches a button — that's pagy's `hasButtonLikeBlock` suppression. */
function collectTextBlocks(
  state: EditorState,
  from: number,
  to: number,
): TextBlock[] | null {
  const blocks: TextBlock[] = [];
  let touchesButton = false;
  state.doc.nodesBetween(from, to, (node, pos) => {
    const name = node.type.name;
    if (name === "button") {
      touchesButton = true;
      return false;
    }
    if (name === "paragraph" || name === "heading") {
      blocks.push({ node, pos });
      return false;
    }
    return true;
  });
  return touchesButton ? null : blocks;
}

function effectiveSize(node: PmNode): Size {
  const explicit = node.attrs["size"] as Size | null;
  if (explicit) return explicit;
  return node.type.name === "heading"
    ? defaultHeadingSize((node.attrs["level"] as number) ?? 1)
    : PARAGRAPH_DEFAULT_SIZE;
}

function computeShape(state: EditorState): SelectionShape | null {
  const sel = state.selection;
  if (sel.empty || !(sel instanceof TextSelection)) return null;
  if (!state.doc.textBetween(sel.from, sel.to, " ").length) return null;
  // Mid shuffle drag the whole chrome fades; the toolbar goes with it.
  if (shufflePluginKey.getState(state)?.activeNodePos != null) return null;

  const blocks = collectTextBlocks(state, sel.from, sel.to);
  if (!blocks || blocks.length === 0) return null;

  const matching = TEXT_TYPE_OPTIONS.find((opt) =>
    blocks.every((b) => isCurrentType(b.node, opt)),
  );
  const first = blocks[0]!;

  const colorType = state.schema.marks["textColor"];
  const afterStart = state.doc.resolve(sel.from).nodeAfter;
  const colorMark =
    colorType && afterStart
      ? colorType.isInSet(afterStart.marks)
      : undefined;

  const linkType = state.schema.marks["link"];
  const linkActive =
    !!linkType && state.doc.rangeHasMark(sel.from, sel.to, linkType);

  return {
    from: sel.from,
    to: sel.to,
    blocks,
    typeLabel: matching?.label ?? "Multiple",
    size: effectiveSize(first.node),
    align: (first.node.attrs["align"] as Align) ?? "left",
    anyHeading: blocks.some((b) => b.node.type.name === "heading"),
    activeColor: (colorMark?.attrs["color"] as TextColor) ?? null,
    linkActive,
  };
}

/** Swatch fill for a theme slot. Resolves against the `site` class on
 *  the trigger (pagy puts `site theme -x` on its swatch button for the
 *  same reason: the theme vars are scoped to the canvas). */
function swatchColor(color: TextColor | null): string {
  if (color === null) return "var(--color-neutral)";
  if (color === "muted") return "var(--color-neutral-80)";
  if (color === "light") return "var(--color-neutral-60)";
  return `var(--color-${color})`;
}

export function TextSelectionToolbar() {
  const editorState = useEditorState();
  const [linkOpen, setLinkOpen] = useState(false);
  const linkRangeRef = useRef<LinkRange | null>(null);
  const linkRectRef = useRef<DOMRect | null>(null);

  const shape = useMemo(() => computeShape(editorState), [editorState]);

  // Deliberate divergence from pagy: the toolbar waits for the mouse
  // to be RELEASED before revealing. Pagy pops it mid-drag, which
  // means it chases the live rect while you're still sweeping —
  // suppressing until mouseup keeps the gesture clean. (Keyboard
  // selection has no held button, so shift+arrows reveal immediately.)
  const [mouseHeld, setMouseHeld] = useState(false);
  useEditorEffect((view) => {
    const onMouseDown = (event: MouseEvent) => {
      if (event.button === 0) setMouseHeld(true);
    };
    // mouseup on the document — a sweep can end outside the editor.
    const onMouseUp = () => setMouseHeld(false);
    view.dom.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      view.dom.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  // Keep the last shape through hide so the exit fade has content to
  // show — the pill stays mounted, `data-open` drives the reveal.
  const lastShapeRef = useRef<SelectionShape | null>(null);
  if (shape) lastShapeRef.current = shape;
  const render = shape ?? lastShapeRef.current;
  const open = !!shape && !linkOpen && !mouseHeld;

  const { refs, floatingStyles } = useFloating({
    placement: "top",
    middleware: [offset(8), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  // Anchor to the live DOM selection via a virtual reference.
  // `contextElement` gives autoUpdate a real node to watch for
  // scroll/resize. Keyed on `shape` (one object per editor-state
  // change) so the rect tracks typing and selection growth — but NOT
  // on every render: setReference triggers a floating-ui re-render,
  // and an unkeyed effect would loop on it (React "maximum update
  // depth"). Same reason BlockToolbar keys its anchor effect.
  useEditorEffect(
    (view) => {
      if (!shape) return;
      const domSel = window.getSelection();
      if (!domSel || domSel.rangeCount === 0 || domSel.isCollapsed) return;
      const range = domSel.getRangeAt(0);
      refs.setReference({
        getBoundingClientRect: () => range.getBoundingClientRect(),
        contextElement: view.dom,
      });
    },
    [shape, refs],
  );

  // ── Actions. Each recomputes the touched blocks from the live view
  // state — the rendered shape can be a frame stale.

  const setType = useEditorEventCallback((view, opt: TypeOption) => {
    const { from, to } = view.state.selection;
    const blocks = collectTextBlocks(view.state, from, to);
    if (!blocks?.length) return;
    convertBlockTypes(
      view,
      blocks.map((b) => b.pos),
      opt,
      { quiet: isQuietSelection(view.state) },
    );
    view.focus();
  });

  const setBlockAttr = useEditorEventCallback(
    (view, name: "align" | "size", value: Align | Size) => {
      const { from, to } = view.state.selection;
      const blocks = collectTextBlocks(view.state, from, to);
      if (!blocks?.length) return;
      const tr = view.state.tr;
      for (const block of blocks) tr.setNodeAttribute(block.pos, name, value);
      view.dispatch(tr);
      view.focus();
    },
  );

  const toggleMarkByName = useEditorEventCallback(
    (view, markName: "strong" | "em" | "strike") => {
      const type = view.state.schema.marks[markName];
      if (!type) return;
      toggleMark(type)(view.state, view.dispatch);
      view.focus();
    },
  );

  const setColor = useEditorEventCallback((view, color: TextColor | null) => {
    const type = view.state.schema.marks["textColor"];
    if (!type) return;
    const { from, to } = view.state.selection;
    view.dispatch(
      color === null
        ? view.state.tr.removeMark(from, to, type)
        : view.state.tr.addMark(from, to, type.create({ color })),
    );
    view.focus();
  });

  /** Apply an empty link mark (pagy's `insertLink(editor, "")`) and
   *  open the popover. The selection rect is captured NOW — focus
   *  moves into the popover's URL input and the DOM selection rect
   *  stops being available. */
  const openLink = useEditorEventCallback((view) => {
    const linkType = view.state.schema.marks["link"];
    if (!linkType) return;
    const { from, to } = view.state.selection;
    const domSel = window.getSelection();
    if (domSel && domSel.rangeCount > 0) {
      linkRectRef.current = domSel.getRangeAt(0).getBoundingClientRect();
    }
    linkRangeRef.current = { from, to };
    if (!view.state.doc.rangeHasMark(from, to, linkType)) {
      view.dispatch(
        view.state.tr.addMark(from, to, linkType.create({ href: "" })),
      );
    }
    setLinkOpen(true);
  });

  if (!render) return null;

  return createPortal(
    <>
      <div
        ref={refs.setFloating}
        className="pb-text-toolbar-anchor"
        style={floatingStyles}
      >
        <div
          className="pb-text-toolbar"
          data-open={open || undefined}
          onMouseDown={(event) => event.preventDefault()}
        >
          <TooltipProvider delayDuration={200} skipDelayDuration={300}>
            <ToolDropdown
              tooltip="Type"
              triggerLabel={render.typeLabel}
            >
              {TEXT_TYPE_OPTIONS.map((opt) => (
                <MenuCheckItem
                  key={opt.label}
                  label={opt.label}
                  checked={render.blocks.every((b) => isCurrentType(b.node, opt))}
                  onSelect={() => setType(opt)}
                />
              ))}
            </ToolDropdown>

            <ToolDropdown tooltip="Size" triggerLabel={SIZE_LABELS[render.size]}>
              {SIZE_VALUES.map((value) => (
                <MenuCheckItem
                  key={value}
                  label={SIZE_LABELS[value]}
                  checked={render.blocks.every(
                    (b) => effectiveSize(b.node) === value,
                  )}
                  onSelect={() => setBlockAttr("size", value)}
                />
              ))}
            </ToolDropdown>

            {ALIGN_VALUES.map((value) => (
              <Tooltip key={value} label={`Align ${ALIGN_LABELS[value].toLowerCase()}`}>
                <button
                  type="button"
                  className="pb-text-tool"
                  data-active={render.align === value || undefined}
                  onClick={() => setBlockAttr("align", value)}
                >
                  {value === "left" && <TextAlignLeft size={16} />}
                  {value === "center" && <TextAlignCenter size={16} />}
                  {value === "right" && <TextAlignRight size={16} />}
                </button>
              </Tooltip>
            ))}

            <span className="pb-text-toolbar-separator" aria-hidden />

            {/* Pagy suppresses Bold for headings — they're already
                bold; toggling `strong` would just double-weight. */}
            {!render.anyHeading && (
              <Tooltip label="Bold">
                <button
                  type="button"
                  className="pb-text-tool -bold"
                  data-active={
                    isMarkActive(editorState, editorState.schema.marks["strong"]!) ||
                    undefined
                  }
                  onClick={() => toggleMarkByName("strong")}
                >
                  B
                </button>
              </Tooltip>
            )}
            <Tooltip label="Italic">
              <button
                type="button"
                className="pb-text-tool"
                data-active={
                  isMarkActive(editorState, editorState.schema.marks["em"]!) ||
                  undefined
                }
                onClick={() => toggleMarkByName("em")}
              >
                <em>I</em>
              </button>
            </Tooltip>
            <Tooltip label="Strikethrough">
              <button
                type="button"
                className="pb-text-tool"
                data-active={
                  isMarkActive(editorState, editorState.schema.marks["strike"]!) ||
                  undefined
                }
                onClick={() => toggleMarkByName("strike")}
              >
                <del>S</del>
              </button>
            </Tooltip>

            <ToolDropdown
              tooltip="Color"
              /* `site` puts the theme's CSS variables in scope so the
                 swatch can resolve them outside the canvas — pagy adds
                 the same classes to its swatch trigger. */
              triggerClassName="site"
              triggerLabel={
                <span
                  className="pb-text-swatch"
                  style={{ background: swatchColor(render.activeColor) }}
                />
              }
            >
              <MenuCheckItem
                label="Default"
                swatch={swatchColor(null)}
                checked={render.activeColor === null}
                onSelect={() => setColor(null)}
              />
              {TEXT_COLOR_VALUES.map((color) => (
                <MenuCheckItem
                  key={color}
                  label={color.charAt(0).toUpperCase() + color.slice(1)}
                  swatch={swatchColor(color)}
                  checked={render.activeColor === color}
                  onSelect={() => setColor(color)}
                />
              ))}
            </ToolDropdown>

            <Tooltip label="Link">
              <button
                type="button"
                className="pb-text-tool"
                data-active={render.linkActive || undefined}
                onClick={() => openLink()}
              >
                <u>Link</u>
              </button>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {linkOpen && linkRangeRef.current && (
        <LinkPopover
          range={linkRangeRef.current}
          rect={linkRectRef.current}
          onClose={() => setLinkOpen(false)}
        />
      )}
    </>,
    document.body,
  );
}

// ────────────────────────────────────────────────────────────────
// Toolbar building blocks
// ────────────────────────────────────────────────────────────────

/** Label-trigger dropdown (type / size / color pickers). Reuses the
 *  settings popover's `.pb-type-menu` styling so all our menus match. */
function ToolDropdown({
  tooltip,
  triggerLabel,
  triggerClassName,
  children,
}: {
  tooltip: string;
  triggerLabel: ReactNode;
  triggerClassName?: string;
  children: ReactNode;
}) {
  return (
    <DropdownMenu.Root modal={false}>
      <Tooltip label={tooltip}>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className={`pb-text-tool -label${triggerClassName ? ` ${triggerClassName}` : ""}`}
          >
            {triggerLabel}
            <CaretDown size={11} weight="bold" />
          </button>
        </DropdownMenu.Trigger>
      </Tooltip>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="pb-type-menu"
          align="start"
          sideOffset={6}
          collisionPadding={8}
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function MenuCheckItem({
  label,
  swatch,
  checked,
  onSelect,
}: {
  label: string;
  swatch?: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenu.Item
      className="pb-type-menu-item"
      data-active={checked || undefined}
      onSelect={(event) => {
        event.preventDefault();
        onSelect();
      }}
    >
      <span className="pb-type-menu-item-main">
        {swatch && (
          <span className="pb-text-swatch site" style={{ background: swatch }} />
        )}
        <span>{label}</span>
      </span>
      {checked && <Check size={14} weight="bold" />}
    </DropdownMenu.Item>
  );
}
