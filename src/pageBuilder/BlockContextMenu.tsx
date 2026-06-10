/**
 * Right-click context menu for blocks.
 *
 *   • Single text block      → Turn into ▸ / Align ▸ / Size ▸,
 *                              Duplicate, Ungroup (when nested), Delete
 *   • Container or card      → Turn into ▸ (Container/Card),
 *                              Duplicate, Ungroup, Delete
 *   • Other single blocks    → Duplicate, Ungroup (when nested), Delete
 *   • Multi-selection        → Group (wrap in a container), Delete
 *
 * Which blocks it acts on is owned by `blockHighlightPlugin`: its
 * mousedown handler makes right-click selections *quiet* (ring shows,
 * settings popover stays closed — this menu owns the interaction) and
 * keeps a selection alive when the click lands on or inside a member.
 * "Turn into" shares its option list + convert logic with the popover
 * switcher via `typeOptions.ts`, so the two UIs can't drift.
 *
 * Built on Radix DropdownMenu (same primitive as the popover's type
 * switcher) anchored to a zero-size element at the cursor — that buys
 * submenu hover intent, collision handling, keyboard nav, and light
 * dismissal for free.
 */

"use client";

import {
  useEditorEffect,
  useEditorEventCallback,
  useEditorState,
} from "@handlewithcare/react-prosemirror";
import { CaretRight, Check, Copy, StackSimple, Trash } from "@phosphor-icons/react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { EditorState } from "prosemirror-state";
import { useState, type ReactNode } from "react";

import {
  getSelectedBlockPositions,
  isPointInTextSelection,
  setSelectedBlocks,
} from "./blockHighlightPlugin";
import {
  ALIGN_LABELS,
  SIZE_LABELS,
  convertBlockType,
  isCurrentType,
  typeOptionsFor,
} from "./blockSettings/typeOptions";
import {
  ALIGN_VALUES,
  SIZE_VALUES,
  defaultHeadingSize,
  type Align,
  type Size,
} from "./schema";

/** Node types a right-click offers "Ungroup" for. Container and card
 *  share the same content model (`block+`), so unwrapping is the same
 *  operation for both. */
const GROUP_TYPES = new Set(["container", "card"]);

/** Drops positions nested inside other selected nodes — acting on a
 *  parent already covers its children, and deleting/moving a child
 *  before its selected parent would corrupt the parent's range. */
function pruneNested(state: EditorState, positions: number[]): number[] {
  return positions.filter(
    (pos) =>
      !positions.some((other) => {
        if (other === pos || other > pos) return false;
        const node = state.doc.nodeAt(other);
        return node != null && pos < other + node.nodeSize;
      }),
  );
}

/** The parent node shared by every position, or null when they live
 *  under different parents — the precondition for grouping (a
 *  container has one home). The caller also uses the parent's type:
 *  blocks already inside a container/card don't get a Group option,
 *  since nesting a container in a container is pure waste. */
function sharedParent(
  state: EditorState,
  positions: number[],
): { typeName: string } | null {
  if (positions.length === 0) return null;
  let key: string | null = null;
  let typeName: string | null = null;
  for (const pos of positions) {
    const $pos = state.doc.resolve(pos);
    const posKey = `${$pos.depth}:${$pos.depth === 0 ? 0 : $pos.start($pos.depth)}`;
    if (key == null) {
      key = posKey;
      typeName = $pos.parent.type.name;
    } else if (posKey !== key) {
      return null;
    }
  }
  return typeName ? { typeName } : null;
}

/** Position of the clicked block itself when it's a container/card,
 *  else the nearest enclosing container/card, else null. A container's
 *  children fill its box, so a right-click "on the container" always
 *  resolves to an inner block — Ungroup has to reach the wrapper
 *  through its children or it's unreachable by mouse. */
function nearestGroupPos(state: EditorState, pos: number): number | null {
  const node = state.doc.nodeAt(pos);
  if (node && GROUP_TYPES.has(node.type.name)) return pos;
  const $pos = state.doc.resolve(pos);
  for (let depth = $pos.depth; depth >= 1; depth--) {
    if (GROUP_TYPES.has($pos.node(depth).type.name)) return $pos.before(depth);
  }
  return null;
}

// ────────────────────────────────────────────────────────────────
// Menu building blocks — thin wrappers over Radix with our classes.
// ────────────────────────────────────────────────────────────────

function Item({
  icon,
  label,
  destructive,
  disabled,
  title,
  onSelect,
}: {
  icon?: ReactNode;
  label: string;
  destructive?: boolean;
  disabled?: boolean;
  title?: string;
  onSelect: () => void;
}) {
  return (
    <DropdownMenu.Item
      className={`pb-context-menu-item${destructive ? " -destructive" : ""}`}
      disabled={disabled}
      title={title}
      onSelect={onSelect}
    >
      {icon}
      <span className="pb-context-menu-label">{label}</span>
    </DropdownMenu.Item>
  );
}

function CheckItem({
  label,
  checked,
  onSelect,
}: {
  label: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenu.Item
      className="pb-context-menu-item"
      data-active={checked || undefined}
      onSelect={onSelect}
    >
      <span className="pb-context-menu-label">{label}</span>
      {checked && <Check size={13} weight="bold" />}
    </DropdownMenu.Item>
  );
}

function Sub({ label, children }: { label: string; children: ReactNode }) {
  return (
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger className="pb-context-menu-item">
        <span className="pb-context-menu-label">{label}</span>
        <CaretRight size={12} weight="bold" className="pb-context-menu-caret" />
      </DropdownMenu.SubTrigger>
      <DropdownMenu.Portal>
        <DropdownMenu.SubContent
          className="pb-context-menu -sub"
          sideOffset={4}
          alignOffset={-7}
          collisionPadding={8}
        >
          {children}
        </DropdownMenu.SubContent>
      </DropdownMenu.Portal>
    </DropdownMenu.Sub>
  );
}

const Separator = () => (
  <DropdownMenu.Separator className="pb-context-menu-separator" />
);

// ────────────────────────────────────────────────────────────────

export function BlockContextMenu() {
  const editorState = useEditorState();
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  // Open on right-click over a block. The (quiet) selection was already
  // set by blockHighlightPlugin's mousedown, which fires before
  // contextmenu.
  useEditorEffect((view) => {
    const onContextMenu = (event: MouseEvent) => {
      // Right-click on the live text selection → the browser's native
      // menu (Cut/Copy/Paste), pagy-style. The block menu's transform
      // actions don't apply to a text range anyway.
      if (isPointInTextSelection(view, event)) return;
      const target = event.target as HTMLElement | null;
      const blockEl = target?.closest(".shuffle-block");
      if (!blockEl || blockEl === view.dom) return; // gutter → native menu
      event.preventDefault();
      setMenu({ x: event.clientX, y: event.clientY });
    };
    view.dom.addEventListener("contextmenu", onContextMenu);
    return () => view.dom.removeEventListener("contextmenu", onContextMenu);
  }, []);

  const setAttr = useEditorEventCallback(
    (view, pos: number, name: string, value: unknown) => {
      view.dispatch(view.state.tr.setNodeAttribute(pos, name, value));
    },
  );

  const turnInto = useEditorEventCallback(
    (view, pos: number, opt: Parameters<typeof convertBlockType>[2]) => {
      convertBlockType(view, pos, opt, { quiet: true });
    },
  );

  const duplicate = useEditorEventCallback((view, pos: number) => {
    const node = view.state.doc.nodeAt(pos);
    if (!node) return;
    view.dispatch(view.state.tr.insert(pos + node.nodeSize, node));
  });

  const remove = useEditorEventCallback((view, positions: number[]) => {
    const pruned = pruneNested(view.state, positions).sort((a, b) => b - a);
    const tr = view.state.tr;
    for (const pos of pruned) {
      const node = view.state.doc.nodeAt(pos);
      if (node) tr.delete(pos, pos + node.nodeSize);
    }
    view.dispatch(setSelectedBlocks(tr, []));
  });

  /** Wrap the selected siblings in a container, in document order, at
   *  the first block's slot. The container spans the union of the
   *  blocks' explicit shuffle columns when they all have them. */
  const group = useEditorEventCallback((view, positions: number[]) => {
    const { state } = view;
    const containerType = state.schema.nodes["container"];
    if (!containerType) return;
    const sorted = pruneNested(state, positions).sort((a, b) => a - b);
    const parent = sharedParent(state, sorted);
    if (sorted.length < 2 || !parent || GROUP_TYPES.has(parent.typeName))
      return;
    const nodes = sorted
      .map((pos) => state.doc.nodeAt(pos))
      .filter((node): node is NonNullable<typeof node> => node != null);

    const starts = nodes
      .map((node) => node.attrs["shuffleStart"])
      .filter((v): v is number => typeof v === "number");
    const ends = nodes
      .map((node) => node.attrs["shuffleEnd"])
      .filter((v): v is number => typeof v === "number");
    const attrs =
      starts.length === nodes.length && ends.length === nodes.length
        ? { shuffleStart: Math.min(...starts), shuffleEnd: Math.max(...ends) }
        : null;

    const tr = state.tr;
    // Delete top-down so lower positions stay valid; the first block's
    // position then doubles as the insertion slot.
    for (let i = sorted.length - 1; i >= 0; i--) {
      const pos = sorted[i]!;
      const node = state.doc.nodeAt(pos)!;
      tr.delete(pos, pos + node.nodeSize);
    }
    const insertAt = sorted[0]!;
    tr.insert(insertAt, containerType.create(attrs, nodes));
    view.dispatch(setSelectedBlocks(tr, [insertAt], true));
  });

  /** Replace a container/card with its children, selecting them. */
  const ungroup = useEditorEventCallback((view, pos: number) => {
    const node = view.state.doc.nodeAt(pos);
    if (!node || !GROUP_TYPES.has(node.type.name)) return;
    const childPositions: number[] = [];
    let childPos = pos;
    node.content.forEach((child) => {
      childPositions.push(childPos);
      childPos += child.nodeSize;
    });
    const tr = view.state.tr.replaceWith(
      pos,
      pos + node.nodeSize,
      node.content,
    );
    view.dispatch(setSelectedBlocks(tr, childPositions, true));
  });

  if (!menu) return null;

  const selected = getSelectedBlockPositions(editorState);
  if (selected.length === 0) return null;
  const pruned = pruneNested(editorState, selected);
  const multi = pruned.length > 1;
  const singlePos = pruned[0]!;
  const singleNode = editorState.doc.nodeAt(singlePos);
  if (!singleNode) return null;

  // Ungroup reaches the block itself OR its nearest container/card
  // wrapper — a right-click "on a container" always lands on a child.
  const groupPos = multi ? null : nearestGroupPos(editorState, singlePos);
  const parent = multi ? sharedParent(editorState, pruned) : null;
  // No Group option when the blocks already live in a container/card —
  // wrapping them in another one is pure nesting waste. Mixed parents
  // shows it disabled (with the why); a group-type parent hides it.
  const showGroup = multi && (!parent || !GROUP_TYPES.has(parent.typeName));
  const canGroup = parent != null && !GROUP_TYPES.has(parent.typeName);

  const typeOptions = multi ? null : typeOptionsFor(singleNode);
  const isTextBlock =
    !multi &&
    (singleNode.type.name === "paragraph" ||
      singleNode.type.name === "heading");
  const align = (singleNode.attrs["align"] as Align) ?? "left";
  const size =
    (singleNode.attrs["size"] as Size | null) ??
    (singleNode.type.name === "heading"
      ? defaultHeadingSize((singleNode.attrs["level"] as number) ?? 1)
      : "m");

  return (
    <DropdownMenu.Root
      open
      onOpenChange={(open) => {
        if (!open) setMenu(null);
      }}
      modal={false}
    >
      <DropdownMenu.Trigger asChild>
        <span
          aria-hidden
          style={{
            position: "fixed",
            top: menu.y,
            left: menu.x,
            width: 0,
            height: 0,
          }}
        />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="pb-context-menu"
          side="bottom"
          align="start"
          sideOffset={2}
          collisionPadding={8}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {multi ? (
            showGroup && (
              <>
                <Item
                  icon={<StackSimple size={15} weight="regular" />}
                  label={`Group ${pruned.length} blocks`}
                  disabled={!canGroup}
                  title={
                    canGroup
                      ? undefined
                      : "Blocks must share a parent to group"
                  }
                  onSelect={() => group(pruned)}
                />
                <Separator />
              </>
            )
          ) : (
            <>
              {typeOptions && (
                <Sub label="Turn into">
                  {typeOptions.map((opt) => (
                    <CheckItem
                      key={opt.label}
                      label={opt.label}
                      checked={isCurrentType(singleNode, opt)}
                      onSelect={() => turnInto(singlePos, opt)}
                    />
                  ))}
                </Sub>
              )}
              {isTextBlock && (
                <>
                  <Sub label="Align">
                    {ALIGN_VALUES.map((value) => (
                      <CheckItem
                        key={value}
                        label={ALIGN_LABELS[value]}
                        checked={align === value}
                        onSelect={() => setAttr(singlePos, "align", value)}
                      />
                    ))}
                  </Sub>
                  <Sub label="Size">
                    {SIZE_VALUES.map((value) => (
                      <CheckItem
                        key={value}
                        label={SIZE_LABELS[value]}
                        checked={size === value}
                        onSelect={() => setAttr(singlePos, "size", value)}
                      />
                    ))}
                  </Sub>
                </>
              )}
              {(typeOptions || isTextBlock) && <Separator />}
              <Item
                icon={<Copy size={15} weight="regular" />}
                label="Duplicate"
                onSelect={() => duplicate(singlePos)}
              />
              {groupPos != null && (
                <Item
                  icon={<StackSimple size={15} weight="regular" />}
                  label="Ungroup"
                  onSelect={() => ungroup(groupPos)}
                />
              )}
              <Separator />
            </>
          )}
          <Item
            destructive
            icon={<Trash size={15} weight="regular" />}
            label={multi ? `Delete ${pruned.length} blocks` : "Delete"}
            onSelect={() => remove(pruned)}
          />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
