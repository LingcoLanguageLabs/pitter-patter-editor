/**
 * Floating block-level toolbar (Pagy-style). Anchors to the right edge
 * of the *selected* block. Selection is its own piece of UI state —
 * deliberately decoupled from ProseMirror's text selection so that
 * typing, cursor drift, and gutter clicks don't activate or dismiss it.
 *
 * Activation:
 *   • pointerup inside a block sets that block as selected.
 *   • clicking the same block again does nothing (text-block); for
 *     container/void blocks it would toggle off, but pitter-patter
 *     doesn't have those wired here yet.
 *
 * Dismissal (mirrors Pagy's rules — see pagy.co/src/editor/slate-editor):
 *   • Click anywhere outside the editor surface and outside the panel.
 *   • Escape key.
 *   • The host editor unmounts.
 *
 * Pointerup inside the editor but NOT on a block (gutter) is a no-op —
 * the panel persists. This was the source of my prior dismiss bug.
 */

import {
  CaretDown,
  Copy,
  TextAlignCenter,
  TextAlignLeft,
  TextAlignRight,
  Trash,
} from "@phosphor-icons/react";
import {
  useEditorEffect,
  useEditorEventCallback,
  useEditorState,
} from "@handlewithcare/react-prosemirror";
import * as RadixDropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  autoUpdate,
  flip,
  offset,
  shift,
  useFloating,
} from "@floating-ui/react";
import { setBlockType } from "prosemirror-commands";
import type { Node as PmNode, NodeType, ResolvedPos } from "prosemirror-model";
import { TextSelection } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  BLOCK_ALIGNS,
  BLOCK_SIZES,
  type BlockAlign,
  type BlockSize,
} from "./FormBuilderEditor";
import { TooltipButton, TooltipProvider } from "./editor/menu";

const WRAPPER_NODES = new Set(["container", "row"]);

interface SelectedBlock {
  node: PmNode;
  pos: number;
}

function findBlockAt($pos: ResolvedPos): SelectedBlock | null {
  for (let depth = $pos.depth; depth >= 1; depth--) {
    const node = $pos.node(depth);
    if (WRAPPER_NODES.has(node.type.name)) continue;
    if (!node.isBlock) continue;
    return { node, pos: $pos.before(depth) };
  }
  return null;
}

/**
 * Find the content block at a clicked position. Tries three sources in
 * order: (1) posAtCoords resolves clicks on text content; (2) when that
 * misses — gutter clicks where resize handles live — we walk doc
 * children and pick the block whose vertical extent contains the click;
 * (3) if no block contains the y, pick the vertically closest one.
 */
function blockFromClick(
  view: EditorView,
  event: PointerEvent,
): SelectedBlock | null {
  const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
  if (coords) {
    const $pos = view.state.doc.resolve(coords.pos);
    const hit = findBlockAt($pos);
    if (hit) return hit;
  }

  // Geometric fallback: walk the doc, skipping container/row wrappers,
  // and pick the block whose y range contains the click (or the
  // vertically nearest one if the click sits between blocks).
  let bestHit: SelectedBlock | null = null;
  let bestDist = Infinity;

  view.state.doc.descendants((node, pos) => {
    if (WRAPPER_NODES.has(node.type.name)) return true; // recurse into wrappers
    if (!node.isBlock) return false;
    const dom = view.nodeDOM(pos);
    if (!(dom instanceof HTMLElement)) return false;
    const r = dom.getBoundingClientRect();
    if (event.clientY >= r.top && event.clientY <= r.bottom) {
      bestHit = { node, pos };
      bestDist = 0;
      return false;
    }
    const dist = Math.min(
      Math.abs(event.clientY - r.top),
      Math.abs(event.clientY - r.bottom),
    );
    if (dist < bestDist) {
      bestDist = dist;
      bestHit = { node, pos };
    }
    return false; // don't recurse into content blocks; they're terminal
  });
  return bestHit;
}

function prettyTypeLabel(node: PmNode): string {
  const name = node.type.name;
  if (name === "heading") {
    const level = node.attrs["level"];
    return typeof level === "number" ? `Heading ${level}` : "Heading";
  }
  if (name === "quiz_item") return "Quiz item";
  if (name === "cloze_item") return "Cloze item";
  if (name === "ordered_list") return "Numbered list";
  if (name === "bullet_list") return "Bullet list";
  return name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, " ");
}

function supportsAttr(node: PmNode, attr: "align" | "size"): boolean {
  const attrs = node.type.spec.attrs;
  return !!attrs && attr in attrs;
}

function setNodeAttr(view: EditorView, pos: number, attr: string, value: unknown) {
  const node = view.state.doc.nodeAt(pos);
  if (!node) return;
  const tr = view.state.tr.setNodeMarkup(pos, undefined, {
    ...node.attrs,
    [attr]: value,
  });
  view.dispatch(tr);
}

function duplicateBlock(view: EditorView, selected: SelectedBlock) {
  const insertAt = selected.pos + selected.node.nodeSize;
  const tr = view.state.tr.insert(
    insertAt,
    selected.node.copy(selected.node.content),
  );
  const $resolved = tr.doc.resolve(insertAt + 1);
  tr.setSelection(TextSelection.near($resolved));
  view.dispatch(tr.scrollIntoView());
}

function deleteBlock(view: EditorView, selected: SelectedBlock) {
  const tr = view.state.tr.delete(
    selected.pos,
    selected.pos + selected.node.nodeSize,
  );
  view.dispatch(tr.scrollIntoView());
}

export function BlockToolbar() {
  const editorState = useEditorState();
  const viewRef = useRef<EditorView | null>(null);
  const floatingDomRef = useRef<HTMLElement | null>(null);
  const [selected, setSelected] = useState<SelectedBlock | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Pin selection to the live node at `selected.pos` so attr changes
  // (align/size) re-render the panel with the latest values.
  const liveSelected: SelectedBlock | null = (() => {
    if (!selected || !editorState) return selected;
    const node = editorState.doc.nodeAt(selected.pos);
    if (!node) return null;
    return { node, pos: selected.pos };
  })();

  const { refs, floatingStyles, update } = useFloating({
    placement: "right-start",
    middleware: [offset(16), flip(), shift({ padding: 12 })],
    whileElementsMounted: autoUpdate,
  });

  // Stash the EditorView so the document-level click-outside handler
  // (which runs in a separate effect) can ask whether a click landed
  // inside the editor.
  useEditorEffect((view) => {
    viewRef.current = view;
  }, []);

  // Anchor floating-ui to the selected block's DOM element. Re-runs
  // when the selection changes or when the doc changes (insertions
  // can shift positions).
  useEditorEffect(
    (view) => {
      if (!liveSelected) {
        refs.setReference(null);
        return;
      }
      const dom = view.nodeDOM(liveSelected.pos);
      if (dom instanceof HTMLElement) {
        refs.setReference(dom);
        update();
      } else {
        refs.setReference(null);
      }
    },
    [liveSelected?.pos, editorState, refs, update],
  );

  // Activation: pointerup inside the editor selects the block under
  // (or nearest to) the click. blockFromClick uses posAtCoords for
  // clicks on text, then falls back to a geometric scan of doc
  // children — that's what makes gutter clicks pick the right block,
  // matching where shuffle's resize handles appear.
  useEditorEffect((view) => {
    const handler = (event: PointerEvent) => {
      const block = blockFromClick(view, event);
      if (!block) return;
      setSelected((prev) => (prev?.pos === block.pos ? prev : block));
    };
    view.dom.addEventListener("pointerup", handler);
    return () => {
      view.dom.removeEventListener("pointerup", handler);
    };
  }, []);

  // Dismissal: any click outside the editor surface and outside the
  // toolbar panel clears the selection. Capture-phase so we run
  // before app code that might `stopPropagation`.
  useEffect(() => {
    if (!selected) return;
    const onClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      const view = viewRef.current;
      if (view?.dom.contains(target)) return;
      if (floatingDomRef.current?.contains(target)) return;
      setSelected(null);
    };
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
    };
  }, [selected]);

  // Escape dismisses.
  useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [selected]);

  const onDuplicate = useEditorEventCallback((view) => {
    if (!view || !liveSelected) return;
    duplicateBlock(view, liveSelected);
    setSelected(null);
  });

  const onDelete = useEditorEventCallback((view) => {
    if (!view || !liveSelected) return;
    deleteBlock(view, liveSelected);
    setSelected(null);
  });

  const onSetAlign = useEditorEventCallback(
    (view, value: BlockAlign | null) => {
      if (!view || !liveSelected) return;
      setNodeAttr(view, liveSelected.pos, "align", value);
    },
  );

  const onSetSize = useEditorEventCallback((view, value: BlockSize | null) => {
    if (!view || !liveSelected) return;
    setNodeAttr(view, liveSelected.pos, "size", value);
  });

  const onSetType = useEditorEventCallback(
    (view, typeName: string, attrs?: Record<string, unknown>) => {
      if (!view || !liveSelected) return;
      const nodeType = view.state.schema.nodes[typeName] as NodeType | undefined;
      if (!nodeType) return;
      const tr = view.state.tr.setNodeMarkup(
        liveSelected.pos,
        nodeType,
        { ...liveSelected.node.attrs, ...(attrs ?? {}) },
      );
      view.dispatch(tr);
    },
  );

  const setFloatingRef = useCallback(
    (node: HTMLElement | null) => {
      refs.setFloating(node);
      floatingDomRef.current = node;
    },
    [refs],
  );

  if (!liveSelected) return null;

  const align = (liveSelected.node.attrs["align"] as BlockAlign | null) ?? null;
  const size = (liveSelected.node.attrs["size"] as BlockSize | null) ?? null;
  const hasAlign = supportsAttr(liveSelected.node, "align");
  const hasSize = supportsAttr(liveSelected.node, "size");

  return createPortal(
    <div
      ref={setFloatingRef}
      className="pp-block-toolbar-anchor"
      style={floatingStyles}
      onMouseDown={(e) => e.preventDefault()}
    >
      <TooltipProvider delayDuration={200} skipDelayDuration={300}>
      <div className="pp-block-toolbar">
        <div className="pp-block-toolbar-header">
          <TypeSwitcher block={liveSelected} onSetType={onSetType} />
          <div className="pp-block-toolbar-actions">
            <TooltipButton
              label="Duplicate"
              aria-label="Duplicate block"
              className="pp-block-toolbar-icon"
              onClick={() => onDuplicate()}
            >
              <Copy size={16} weight="regular" />
            </TooltipButton>
            <TooltipButton
              label="Delete"
              aria-label="Delete block"
              className="pp-block-toolbar-icon"
              onClick={() => onDelete()}
            >
              <Trash size={16} weight="regular" />
            </TooltipButton>
          </div>
        </div>

        {hasAlign && (
          <BlockToolbarSection label="Align">
            <Segmented
              value={align ?? "left"}
              onChange={(value) =>
                onSetAlign(value === "left" ? null : (value as BlockAlign))
              }
              options={[
                {
                  value: "left",
                  label: "Left",
                  icon: <TextAlignLeft size={14} weight="bold" />,
                },
                {
                  value: "center",
                  label: "Center",
                  icon: <TextAlignCenter size={14} weight="bold" />,
                },
                {
                  value: "right",
                  label: "Right",
                  icon: <TextAlignRight size={14} weight="bold" />,
                },
              ]}
            />
          </BlockToolbarSection>
        )}

        {hasSize && (
          <BlockToolbarSection label="Size">
            <Segmented
              value={size ?? "s"}
              onChange={(value) =>
                onSetSize(value === "s" ? null : (value as BlockSize))
              }
              options={BLOCK_SIZES.map((s) => ({
                value: s,
                label: s.toUpperCase(),
              }))}
            />
          </BlockToolbarSection>
        )}

        <button
          type="button"
          className="pp-block-toolbar-advanced"
          onClick={() => setAdvancedOpen((v) => !v)}
          aria-expanded={advancedOpen}
        >
          <span>Advanced</span>
          <CaretDown
            size={12}
            weight="bold"
            style={{
              transform: advancedOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 120ms ease",
            }}
          />
        </button>
        {advancedOpen && (
          <div className="pp-block-toolbar-advanced-panel">
            <div className="pp-block-toolbar-advanced-row">
              <span className="pp-block-toolbar-meta-label">Type</span>
              <code>{liveSelected.node.type.name}</code>
            </div>
            <div className="pp-block-toolbar-advanced-row">
              <span className="pp-block-toolbar-meta-label">Position</span>
              <code>{liveSelected.pos}</code>
            </div>
          </div>
        )}
      </div>
      </TooltipProvider>
    </div>,
    document.body,
  );
}

function BlockToolbarSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="pp-block-toolbar-section">
      <div className="pp-block-toolbar-section-label">{label}</div>
      {children}
    </div>
  );
}

interface SegmentedOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SegmentedOption[];
}) {
  return (
    <div className="pp-block-toolbar-segmented" role="radiogroup">
      {options.map((opt) =>
        // Icon options (align) are unclear without a label — give them a
        // tooltip. Text options (S/M/L…) already read as their label.
        opt.icon ? (
          <TooltipButton
            key={opt.value}
            label={opt.label}
            role="radio"
            aria-checked={opt.value === value}
            data-active={opt.value === value || undefined}
            className="pp-block-toolbar-segment"
            onClick={() => onChange(opt.value)}
          >
            {opt.icon}
          </TooltipButton>
        ) : (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={opt.value === value}
            data-active={opt.value === value || undefined}
            className="pp-block-toolbar-segment"
            onClick={() => onChange(opt.value)}
          >
            <span>{opt.label}</span>
          </button>
        ),
      )}
    </div>
  );
}

const TYPE_OPTIONS: Array<{
  label: string;
  typeName: string;
  attrs?: Record<string, unknown>;
}> = [
  { label: "Paragraph", typeName: "paragraph" },
  { label: "Heading 1", typeName: "heading", attrs: { level: 1 } },
  { label: "Heading 2", typeName: "heading", attrs: { level: 2 } },
  { label: "Heading 3", typeName: "heading", attrs: { level: 3 } },
];

function TypeSwitcher({
  block,
  onSetType,
}: {
  block: SelectedBlock;
  onSetType: (typeName: string, attrs?: Record<string, unknown>) => void;
}) {
  const label = prettyTypeLabel(block.node);
  const canSwitch =
    block.node.type.name === "paragraph" || block.node.type.name === "heading";
  return (
    <RadixDropdownMenu.Root>
      <RadixDropdownMenu.Trigger asChild disabled={!canSwitch}>
        <button type="button" className="pp-block-toolbar-type">
          <span>{label}</span>
          {canSwitch && <CaretDown size={12} weight="bold" />}
        </button>
      </RadixDropdownMenu.Trigger>
      <RadixDropdownMenu.Portal>
        <RadixDropdownMenu.Content
          className="pp-block-toolbar-type-menu"
          side="bottom"
          align="start"
          sideOffset={4}
        >
          {TYPE_OPTIONS.map((opt) => {
            const active =
              block.node.type.name === opt.typeName &&
              (!opt.attrs ||
                Object.entries(opt.attrs).every(
                  ([k, v]) => block.node.attrs[k] === v,
                ));
            return (
              <RadixDropdownMenu.Item
                key={opt.label}
                className="pp-block-toolbar-type-item"
                data-active={active || undefined}
                onSelect={(e) => {
                  e.preventDefault();
                  onSetType(opt.typeName, opt.attrs);
                }}
              >
                {opt.label}
              </RadixDropdownMenu.Item>
            );
          })}
        </RadixDropdownMenu.Content>
      </RadixDropdownMenu.Portal>
    </RadixDropdownMenu.Root>
  );
}

// Quiet unused-imports warning when setBlockType is no longer referenced.
void setBlockType;
