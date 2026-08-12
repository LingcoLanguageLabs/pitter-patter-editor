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
  Highlighter,
  Info,
  TextAlignCenter,
  TextAlignLeft,
  TextAlignRight,
  Translate,
} from "@phosphor-icons/react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { shufflePluginKey } from "@pitter-patter/shuffle";
import { toggleMark } from "prosemirror-commands";
import type {
  MarkType,
  Node as PmNode,
  ResolvedPos,
} from "prosemirror-model";
import { TextSelection, type EditorState } from "prosemirror-state";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { isMarkActive } from "../editor/helpers";
import { Tooltip, TooltipProvider } from "../editor/menu";

import { isQuietSelection } from "./blockHighlightPlugin";
import { itemSelectionActions } from "./items/registry";
import type { ItemSelectionAction } from "./items/types";
import {
  ALIGN_LABELS,
  SIZE_LABELS,
  TEXT_TYPE_OPTIONS,
  convertBlockTypes,
  isCurrentType,
  type TypeOption,
} from "./blockSettings/typeOptions";
import { LinkPopover, type LinkRange } from "./LinkPopover";
import { TooltipPopover, type TooltipRange } from "./TooltipPopover";
import {
  ALIGN_VALUES,
  LANGUAGE_OPTIONS,
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

/** Theme slots offered as marker highlights (solid backgrounds). */
const HIGHLIGHT_COLORS = ["primary", "secondary", "tertiary", "neutral"] as const;

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
  /** The selection's highlight slot (background marker), or null when none. */
  activeHighlight: string | null;
  linkActive: boolean;
  /** Whether the selection carries a `tooltip` gloss. */
  tooltipActive: boolean;
  /** The selection's language tag (BCP-47 code), or null when untagged. */
  activeLanguage: string | null;
  /** Selection is inside item text (prompt/option) — show marks only, hide the
   *  paragraph/heading-only type/size/align controls. */
  richTextOnly: boolean;
}

/** Textblocks the range touches — paragraph/heading AND item text nodes
 *  (`mc_prompt`, `mc_option`, …), so rich-text marks work inside questions too.
 *  Null when the range touches a button — that's pagy's `hasButtonLikeBlock`
 *  suppression. The block-level controls (type/size/align) are gated off for
 *  non-paragraph/heading blocks via `richTextOnly` (see `computeShape`). */
function collectTextBlocks(
  state: EditorState,
  from: number,
  to: number,
): TextBlock[] | null {
  const blocks: TextBlock[] = [];
  let touchesButton = false;
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (node.type.name === "button") {
      touchesButton = true;
      return false;
    }
    if (node.isTextblock) {
      blocks.push({ node, pos });
      return false;
    }
    return true;
  });
  return touchesButton ? null : blocks;
}

/** Block-level controls (type/size/align) only apply to paragraph/heading. A
 *  selection inside any other textblock (an item's prompt/option) is rich-text
 *  only: marks (bold/italic/color/link) work, but type/size/align are hidden. */
function isRichTextOnly(blocks: readonly TextBlock[]): boolean {
  return blocks.some(
    (b) => b.node.type.name !== "paragraph" && b.node.type.name !== "heading",
  );
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

  const highlightType = state.schema.marks["highlight"];
  const highlightMark =
    highlightType && afterStart
      ? highlightType.isInSet(afterStart.marks)
      : undefined;

  const linkType = state.schema.marks["link"];
  const linkActive =
    !!linkType && state.doc.rangeHasMark(sel.from, sel.to, linkType);

  const tooltipType = state.schema.marks["tooltip"];
  const tooltipActive =
    !!tooltipType && state.doc.rangeHasMark(sel.from, sel.to, tooltipType);

  // Language is read like color (the start block's mark) so the dropdown
  // reflects what's tagged at the selection's head.
  const langType = state.schema.marks["language"];
  const langMark =
    langType && afterStart ? langType.isInSet(afterStart.marks) : undefined;

  return {
    from: sel.from,
    to: sel.to,
    blocks,
    typeLabel: matching?.label ?? "Multiple",
    size: effectiveSize(first.node),
    align: (first.node.attrs["align"] as Align) ?? "left",
    anyHeading: blocks.some((b) => b.node.type.name === "heading"),
    activeColor: (colorMark?.attrs["color"] as TextColor) ?? null,
    activeHighlight: (highlightMark?.attrs["color"] as string) ?? null,
    linkActive,
    tooltipActive,
    activeLanguage: (langMark?.attrs["lang"] as string) ?? null,
    richTextOnly: isRichTextOnly(blocks),
  };
}

/** The contiguous range of `markType` covering `$pos` (matching the specific
 *  mark instance at that point), or null if there's no such mark there. Standard
 *  getMarkRange — used to re-open the tooltip popover on the full glossed run
 *  when its term is clicked. */
function getMarkRange(
  $pos: ResolvedPos,
  markType: MarkType,
): { from: number; to: number } | null {
  const start = $pos.parent.childAfter($pos.parentOffset);
  if (!start.node) return null;
  const mark = markType.isInSet(start.node.marks);
  if (!mark) return null;

  let startIndex = $pos.index();
  let startPos = $pos.start() + start.offset;
  let endIndex = startIndex + 1;
  let endPos = startPos + start.node.nodeSize;
  while (startIndex > 0 && mark.isInSet($pos.parent.child(startIndex - 1).marks)) {
    startIndex -= 1;
    startPos -= $pos.parent.child(startIndex).nodeSize;
  }
  while (
    endIndex < $pos.parent.childCount &&
    mark.isInSet($pos.parent.child(endIndex).marks)
  ) {
    endPos += $pos.parent.child(endIndex).nodeSize;
    endIndex += 1;
  }
  return { from: startPos, to: endPos };
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
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const tooltipRangeRef = useRef<TooltipRange | null>(null);
  const tooltipRectRef = useRef<DOMRect | null>(null);

  const shape = useMemo(() => computeShape(editorState), [editorState]);

  // Item-contributed selection actions (e.g. Fill Blanks' "Mark as blank"),
  // available for the current selection. Driven by the registry, not hard-coded.
  const selectionActions = useMemo(
    () => itemSelectionActions().filter((a) => a.isAvailable(editorState)),
    [editorState],
  );
  const runSelectionAction = useEditorEventCallback(
    (view, action: ItemSelectionAction) => {
      action.run(view.state, view.dispatch);
      view.focus();
    },
  );

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

  // Click a glossed term → reopen its edit popup. A `click` (not mousedown) so a
  // drag that starts on the term still selects text normally; a clean click
  // selects the whole glossed run and opens the popover anchored to the term.
  useEditorEffect((view) => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const termEl = target?.closest?.(".pp-tooltip-term");
      if (!termEl || !view.dom.contains(termEl)) return;
      const tooltipType = view.state.schema.marks["tooltip"];
      if (!tooltipType) return;
      // Resolve the mark range from the term's start; retry one position in to
      // cover the boundary case where childAfter lands on the next node.
      const base = view.posAtDOM(termEl, 0);
      let range: { from: number; to: number } | null = null;
      for (const p of [base, base + 1]) {
        if (p < 0) continue;
        range = getMarkRange(view.state.doc.resolve(p), tooltipType);
        if (range) break;
      }
      if (!range) return;
      tooltipRangeRef.current = range;
      tooltipRectRef.current = termEl.getBoundingClientRect();
      view.dispatch(
        view.state.tr.setSelection(
          TextSelection.create(view.state.doc, range.from, range.to),
        ),
      );
      setTooltipOpen(true);
    };
    view.dom.addEventListener("click", onClick);
    return () => view.dom.removeEventListener("click", onClick);
  }, []);

  // While the edit popup is open it floats above the term — suppress the CSS
  // hover-preview bubble so the two don't stack into a double bubble.
  useEditorEffect(
    (view) => {
      view.dom.classList.toggle("pb-tooltip-editing", tooltipOpen);
    },
    [tooltipOpen],
  );

  // Keep the last shape through hide so the exit fade has content to
  // show — the pill stays mounted, `data-open` drives the reveal.
  const lastShapeRef = useRef<SelectionShape | null>(null);
  if (shape) lastShapeRef.current = shape;
  const render = shape ?? lastShapeRef.current;
  const open = !!shape && !linkOpen && !tooltipOpen && !mouseHeld;

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

  /** Apply (or, with null, clear) a marker highlight on the selection — the
   *  background sibling of `setColor`. */
  const setHighlight = useEditorEventCallback((view, color: string | null) => {
    const type = view.state.schema.marks["highlight"];
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

  /** Apply an empty tooltip mark and open its popover — the gloss sibling of
   *  `openLink`. The selection rect is captured NOW; focus moves into the
   *  popover's textarea and the DOM selection rect stops being available. */
  const openTooltip = useEditorEventCallback((view) => {
    const tooltipType = view.state.schema.marks["tooltip"];
    if (!tooltipType) return;
    const { from, to } = view.state.selection;
    const domSel = window.getSelection();
    if (domSel && domSel.rangeCount > 0) {
      tooltipRectRef.current = domSel.getRangeAt(0).getBoundingClientRect();
    }
    tooltipRangeRef.current = { from, to };
    if (!view.state.doc.rangeHasMark(from, to, tooltipType)) {
      view.dispatch(
        view.state.tr.addMark(from, to, tooltipType.create({ content: "" })),
      );
    }
    setTooltipOpen(true);
  });

  /** Tag (or, with null, untag) the selection's language. Applied directly —
   *  there's nothing to edit beyond the choice, so no popover (the color
   *  picker works the same way). */
  const setLanguage = useEditorEventCallback((view, code: string | null) => {
    const type = view.state.schema.marks["language"];
    if (!type) return;
    const { from, to } = view.state.selection;
    view.dispatch(
      code === null
        ? view.state.tr.removeMark(from, to, type)
        : view.state.tr.addMark(from, to, type.create({ lang: code })),
    );
    view.focus();
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
            {/* Block-level controls (type / size / align) apply to
                paragraph/heading only. Inside an item's prompt/option the
                selection is rich-text only, so these are hidden and just the
                inline marks remain. */}
            {!render.richTextOnly && (
              <>
                <ToolDropdown tooltip="Type" triggerLabel={render.typeLabel}>
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
              </>
            )}

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

            {/* Highlight — a marker-style background slot (the bg sibling of
                the text color). */}
            <ToolDropdown
              tooltip="Highlight"
              triggerClassName="site"
              triggerActive={!!render.activeHighlight}
              triggerLabel={<Highlighter size={16} />}
            >
              <MenuCheckItem
                label="None"
                checked={render.activeHighlight === null}
                onSelect={() => setHighlight(null)}
              />
              {HIGHLIGHT_COLORS.map((color) => (
                <MenuCheckItem
                  key={color}
                  label={color.charAt(0).toUpperCase() + color.slice(1)}
                  swatch={`var(--color-${color})`}
                  checked={render.activeHighlight === color}
                  onSelect={() => setHighlight(color)}
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

            {/* Tooltip — gloss a word/phrase a student might not know. */}
            <Tooltip label="Tooltip">
              <button
                type="button"
                className="pb-text-tool"
                data-active={render.tooltipActive || undefined}
                onClick={() => openTooltip()}
              >
                <Info size={16} />
              </button>
            </Tooltip>

            {/* Language — tag a run as a specific language (sets `lang`). */}
            <ToolDropdown
              tooltip="Language"
              triggerActive={!!render.activeLanguage}
              triggerLabel={
                <span className="pb-text-tool-lang">
                  <Translate size={16} />
                  {render.activeLanguage && (
                    <span className="pb-text-tool-lang-code">
                      {render.activeLanguage.toUpperCase()}
                    </span>
                  )}
                </span>
              }
            >
              <MenuCheckItem
                label="None"
                checked={render.activeLanguage === null}
                onSelect={() => setLanguage(null)}
              />
              {LANGUAGE_OPTIONS.map((opt) => (
                <MenuCheckItem
                  key={opt.code}
                  label={opt.label}
                  checked={render.activeLanguage === opt.code}
                  onSelect={() => setLanguage(opt.code)}
                />
              ))}
            </ToolDropdown>

            {/* Item-contributed actions (e.g. "Mark as blank"). */}
            {selectionActions.length > 0 && (
              <span className="pb-text-toolbar-separator" aria-hidden />
            )}
            {selectionActions.map((action) => (
              <Tooltip key={action.key} label={action.label}>
                <button
                  type="button"
                  className="pb-text-tool"
                  data-active={action.isActive?.(editorState) || undefined}
                  onClick={() => runSelectionAction(action)}
                >
                  {action.label}
                </button>
              </Tooltip>
            ))}
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

      {tooltipOpen && tooltipRangeRef.current && (
        <TooltipPopover
          range={tooltipRangeRef.current}
          rect={tooltipRectRef.current}
          onClose={() => setTooltipOpen(false)}
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
  triggerActive,
  children,
}: {
  tooltip: string;
  triggerLabel: ReactNode;
  triggerClassName?: string;
  /** Tints the trigger with the accent color (e.g. a language is tagged). */
  triggerActive?: boolean;
  children: ReactNode;
}) {
  return (
    <DropdownMenu.Root modal={false}>
      <Tooltip label={tooltip}>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className={`pb-text-tool -label${triggerClassName ? ` ${triggerClassName}` : ""}`}
            data-active={triggerActive || undefined}
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
