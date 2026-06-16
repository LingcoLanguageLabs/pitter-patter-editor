/**
 * Layers panel — a Figma-style outline of the whole deck.
 *
 * Mirrors the document structure as a hierarchical, expand/collapse tree:
 *
 *   page → (header? section+ footer?) → block+ → nested card/container/row → leaf
 *
 * Clicking a row selects that node and jumps to it (switching the active slide
 * first when it lives on a dormant page). Hovering a row rings the node on the
 * canvas (Figma-style), via `layerHoverPlugin`. Dragging a row reorders it among
 * siblings, re-parents it into a container, or moves it to another page — all
 * one schema-validated ProseMirror transaction; illegal drops snap back.
 * Double-click a row to rename it (any block can carry a custom layer name).
 *
 * Like the Pages panel, it lives outside the ProseMirror React context, so it
 * reads the serialized tree + selection from the store (mirrored by
 * `editorStoreSyncPlugin`) and dispatches through the stashed `pagesView`.
 *
 * Drag mechanics follow @dnd-kit's sortable-tree pattern: flatten the visible
 * rows, render them indented, project a target depth + parent from the pointer's
 * horizontal offset, then commit the projection as a move.
 */

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  MeasuringStrategy,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLineDown,
  ArrowLineUp,
  ArrowRight,
  Browsers,
  Cards,
  CaretRight,
  Copy,
  FrameCorners,
  PencilSimple,
  PushPin,
  Rows,
  Square,
  StackSimple,
  Trash,
} from "@phosphor-icons/react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { EditorView } from "prosemirror-view";
import { createPortal } from "react-dom";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";

import { BLOCK_CATALOG } from "../blocks/catalog";
import {
  GROUP_TYPES,
  deleteBlocks,
  duplicateBlock,
  groupBlocks,
  sharedParent,
  ungroupBlock,
} from "../blockCommands";
import {
  canDropNode,
  moveNode,
  moveNodeToPage,
  renameLayer,
  selectLayer,
  selectLayers,
} from "../layerCommands";
import { setLayerHover } from "../layerHoverPlugin";
import { deletePage, duplicatePage, movePage } from "../pageCommands";
import type { LayerNode } from "../layerTree";
import { navigateTo, usePageBuilderStore } from "../store";

import { TooltipButton, TooltipProvider } from "../../editor/menu";

/** Pixels of indentation per nesting level. Also the drag x-offset that bumps
 *  the projected depth by one (so dragging right one notch nests one level). */
const INDENT = 14;

// Matches the catalog's icon prop shape so both phosphor icons and catalog
// entries assign cleanly (phosphor's `weight` is a union; `any` bridges it).
type IconComp = ComponentType<{ size?: number; weight?: any }>;

/** Icon per node type, sourced from the "+ Add block" catalog so the tree and
 *  the picker can't drift. Headings key by level (TextHOne…Four). page / header
 *  / footer aren't in the catalog, so they get their own. */
const CATALOG_ICON: Record<string, IconComp> = {};
for (const entry of BLOCK_CATALOG) {
  const key =
    entry.type === "heading"
      ? `heading${(entry.attrs?.["level"] as number) ?? 1}`
      : entry.type;
  if (!CATALOG_ICON[key]) CATALOG_ICON[key] = entry.icon as IconComp;
}

function iconFor(type: string, level: number | null): IconComp {
  if (type === "page") return Browsers;
  if (type === "header") return ArrowLineUp;
  if (type === "footer") return ArrowLineDown;
  if (type === "heading") {
    return (
      CATALOG_ICON[`heading${level ?? 1}`] ?? CATALOG_ICON["heading1"] ?? Square
    );
  }
  return CATALOG_ICON[type] ?? Square;
}

/** The rows currently visible — descendants of a collapsed node are hidden. */
function visibleLayers(
  tree: LayerNode[],
  collapsed: Record<string, true>,
): LayerNode[] {
  const out: LayerNode[] = [];
  let hideBelow: number | null = null;
  for (const node of tree) {
    if (hideBelow !== null && node.depth > hideBelow) continue;
    hideBelow = null;
    out.push(node);
    if (node.hasChildren && collapsed[node.key]) hideBelow = node.depth;
  }
  return out;
}

interface Projection {
  depth: number;
  parentKey: string | null;
  newItems: LayerNode[];
}

/** Project the drop target (depth + parent) from the pointer's horizontal drag
 *  offset, à la @dnd-kit's sortable-tree example. */
function getProjection(
  visible: LayerNode[],
  activeKey: string,
  overKey: string,
  dragOffsetX: number,
): Projection | null {
  const activeIndex = visible.findIndex((n) => n.key === activeKey);
  const overIndex = visible.findIndex((n) => n.key === overKey);
  if (activeIndex === -1 || overIndex === -1) return null;
  const active = visible[activeIndex]!;
  const newItems = arrayMove(visible, activeIndex, overIndex);
  const prevItem = newItems[overIndex - 1];
  const nextItem = newItems[overIndex + 1];

  const dragDepth = Math.round(dragOffsetX / INDENT);
  const projectedDepth = active.depth + dragDepth;
  const maxDepth = prevItem ? prevItem.depth + 1 : 0;
  const minDepth = nextItem ? nextItem.depth : 0;
  let depth = projectedDepth;
  if (depth > maxDepth) depth = maxDepth;
  if (depth < minDepth) depth = minDepth;

  let parentKey: string | null;
  if (depth === 0 || !prevItem) {
    parentKey = null;
  } else if (depth === prevItem.depth) {
    parentKey = prevItem.parentKey;
  } else if (depth > prevItem.depth) {
    parentKey = prevItem.key;
  } else {
    parentKey =
      newItems
        .slice(0, overIndex)
        .reverse()
        .find((n) => n.depth === depth)?.parentKey ?? null;
  }
  return { depth, parentKey, newItems };
}

/** Index among the projected parent's children where the dragged item lands —
 *  the count of same-parent siblings ahead of it in the reordered list. */
function insertIndexFor(
  newItems: LayerNode[],
  activeKey: string,
  parentKey: string | null,
): number {
  let idx = 0;
  for (const node of newItems) {
    if (node.key === activeKey) break;
    if (node.parentKey === parentKey) idx++;
  }
  return idx;
}

export function LayersPanel() {
  const tree = usePageBuilderStore((s) => s.layerTree);
  const collapsed = usePageBuilderStore((s) => s.collapsedLayers);
  const toggleCollapsed = usePageBuilderStore((s) => s.toggleLayerCollapsed);
  const activePageId = usePageBuilderStore((s) => s.activePageId);
  const selectedPositions = usePageBuilderStore((s) => s.selectedLayerPositions);
  const expandLayers = usePageBuilderStore((s) => s.expandLayers);
  const view = usePageBuilderStore((s) => s.pagesView);

  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const [offsetLeft, setOffsetLeft] = useState(0);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; key: string } | null>(
    null,
  );
  const listRef = useRef<HTMLDivElement | null>(null);
  // Anchor for Shift-range multi-select (last plainly/⌘-clicked row).
  const anchorRef = useRef<string | null>(null);

  const visible = useMemo(() => visibleLayers(tree, collapsed), [tree, collapsed]);
  const items = useMemo(() => visible.map((n) => n.key), [visible]);
  const selectedSet = useMemo(
    () => new Set(selectedPositions),
    [selectedPositions],
  );

  // Reveal-on-canvas-select: when the editor selection changes, expand any
  // collapsed ancestors of the selected node, then scroll its row into view —
  // Figma's "click on canvas → reveal in layers". Converges in two passes: the
  // first expands (which re-runs the effect), the second (row now visible)
  // scrolls. Selecting from the tree itself is a harmless no-op (already open).
  useEffect(() => {
    if (!selectedPositions.length) return;
    const target = tree.find((n) => n.pos === selectedPositions[0]);
    if (!target) return;
    const collapsedAncestors: string[] = [];
    let parentKey = target.parentKey;
    while (parentKey) {
      if (collapsed[parentKey]) collapsedAncestors.push(parentKey);
      parentKey = tree.find((n) => n.key === parentKey)?.parentKey ?? null;
    }
    if (collapsedAncestors.length) {
      expandLayers(collapsedAncestors);
      return; // re-runs once the expand lands
    }
    listRef.current
      ?.querySelector(`[data-layer-key="${target.key}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selectedPositions, tree, collapsed, expandLayers]);

  const activeNode = activeKey ? tree.find((n) => n.key === activeKey) : null;

  // Mid-drag projection for a non-page node: the target depth, the resolved
  // receiving container (its key), and whether the drop is legal. Drives the
  // active row's indent, the parent-row highlight, and the valid/invalid
  // insertion line. Pages reorder among themselves, so they skip this.
  const drag = useMemo(() => {
    if (!activeNode || !overKey || activeNode.type === "page") return null;
    const proj = getProjection(visible, activeNode.key, overKey, offsetLeft);
    if (!proj) return null;
    const over = tree.find((n) => n.key === overKey);
    // A null projected parent (dragged to the outermost level) resolves to the
    // target row's page — moveNode then appends into its last section.
    const parent = proj.parentKey
      ? tree.find((n) => n.key === proj.parentKey)
      : over
        ? tree.find((n) => n.type === "page" && n.pageId === over.pageId)
        : undefined;
    const index = insertIndexFor(proj.newItems, activeNode.key, proj.parentKey);
    const valid =
      !!parent && !!view && canDropNode(view.state, activeNode.pos, parent.pos, index);
    return { depth: proj.depth, parentKey: parent?.key ?? null, valid };
  }, [activeNode, overKey, offsetLeft, visible, tree, view]);

  const sensors = useSensors(
    // A few px of travel before a drag starts, so a plain click still selects
    // the layer instead of being swallowed as a zero-distance drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const resetDrag = () => {
    setActiveKey(null);
    setOverKey(null);
    setOffsetLeft(0);
  };

  const onDragEnd = (e: DragEndEvent) => {
    const dragged = activeKey ? tree.find((n) => n.key === activeKey) : null;
    resetDrag();
    if (!view || !e.over || !dragged) return;
    const over = tree.find((n) => n.key === String(e.over!.id));
    if (!over) return;

    // Pages only reorder among pages — drop onto whichever page the target row
    // belongs to (translate to one insert-before-neighbour call, like the
    // Pages panel).
    if (dragged.type === "page") {
      // Depth-0 also holds the global header/footer masters now — reorder among
      // real pages only.
      const pages = tree.filter((n) => n.type === "page");
      const oldIndex = pages.findIndex((n) => n.pageId === dragged.pageId);
      const newIndex = pages.findIndex((n) => n.pageId === over.pageId);
      if (oldIndex === -1 || newIndex === -1) return;
      const reordered = arrayMove(pages, oldIndex, newIndex);
      const at = reordered.findIndex((n) => n.pageId === dragged.pageId);
      movePage(view, dragged.pageId, reordered[at + 1]?.pageId ?? null);
      return;
    }

    const proj = getProjection(visible, dragged.key, over.key, offsetLeft);
    if (!proj) return;

    // Resolve the target parent. A null projected parent (dragged to the
    // outermost level) means "drop into the target row's page" — moveNode then
    // appends into that page's last section.
    let parent = proj.parentKey
      ? tree.find((n) => n.key === proj.parentKey)
      : null;
    if (!parent) {
      parent = tree.find((n) => n.type === "page" && n.pageId === over.pageId);
    }
    if (!parent) return;
    const index = insertIndexFor(proj.newItems, dragged.key, proj.parentKey);
    moveNode(view, dragged.pos, parent.pos, index);
  };

  /** Block/section rows participate in multi-select; pages + global bars don't. */
  const isSelectable = (node: LayerNode) =>
    node.type !== "page" && !node.isGlobalBar;

  /** Click a row: plain → select only it; ⌘/Ctrl → toggle in/out; Shift →
   *  range from the anchor. Modifier selection is limited to selectable rows. */
  const handleSelect = (e: ReactMouseEvent, node: LayerNode) => {
    if (!view) return;
    if (isSelectable(node) && (e.metaKey || e.ctrlKey)) {
      const current = tree.filter(
        (n) => isSelectable(n) && selectedSet.has(n.pos),
      );
      const has = current.some((n) => n.key === node.key);
      const next = has
        ? current.filter((n) => n.key !== node.key)
        : [...current, node];
      if (next.length) selectLayers(view, next);
      else selectLayer(view, node);
      anchorRef.current = node.key;
      return;
    }
    if (isSelectable(node) && e.shiftKey && anchorRef.current) {
      const a = visible.findIndex((n) => n.key === anchorRef.current);
      const b = visible.findIndex((n) => n.key === node.key);
      if (a !== -1 && b !== -1) {
        const [lo, hi] = a < b ? [a, b] : [b, a];
        const range = visible.slice(lo, hi + 1).filter(isSelectable);
        if (range.length) {
          selectLayers(view, range);
          return;
        }
      }
    }
    selectLayer(view, node);
    anchorRef.current = node.key;
  };

  /** Right-click a row: collapse the selection onto it unless it's already part
   *  of a multi-selection (Google-Slides behavior), then open the menu. */
  const handleContextMenu = (e: ReactMouseEvent, node: LayerNode) => {
    e.preventDefault();
    if (!view) return;
    const inMulti = selectedSet.has(node.pos) && selectedSet.size >= 2;
    if (!inMulti) {
      selectLayer(view, node);
      anchorRef.current = node.key;
    }
    setMenu({ x: e.clientX, y: e.clientY, key: node.key });
  };

  if (!tree.length) {
    return (
      <TooltipProvider delayDuration={200} skipDelayDuration={300}>
        <PanelHeader />
        <div className="pb-layers-empty">No layers yet.</div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={200} skipDelayDuration={300}>
      <PanelHeader />
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={(e: DragStartEvent) => {
          setActiveKey(String(e.active.id));
          setOverKey(String(e.active.id));
          if (view) setLayerHover(view, null);
        }}
        onDragMove={(e: DragMoveEvent) => setOffsetLeft(e.delta.x)}
        onDragOver={(e: DragOverEvent) =>
          setOverKey(e.over ? String(e.over.id) : null)
        }
        onDragEnd={onDragEnd}
        onDragCancel={resetDrag}
      >
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          <div
            className="pb-layers"
            ref={listRef}
            onPointerLeave={() => view && setLayerHover(view, null)}
          >
            {visible.map((node) => (
              <SortableLayerRow
                key={node.key}
                node={node}
                view={view}
                depth={
                  node.key === activeKey && drag ? drag.depth : node.depth
                }
                collapsed={!!collapsed[node.key]}
                active={node.type === "page" && node.pageId === activePageId}
                selected={selectedSet.has(node.pos)}
                dropTarget={!!drag && drag.parentKey === node.key}
                // Pages reorder among themselves (no projection), so their drag
                // line reads as valid; node drags use the resolved validity.
                dropValid={drag ? drag.valid : true}
                editing={editingKey === node.key}
                onToggle={() => toggleCollapsed(node.key)}
                onSelect={(e) => handleSelect(e, node)}
                onContextMenu={(e) => handleContextMenu(e, node)}
                onStartRename={() => setEditingKey(node.key)}
                onRename={(name) => {
                  if (view) renameLayer(view, node, name);
                  setEditingKey(null);
                }}
                onCancelRename={() => setEditingKey(null)}
              />
            ))}
          </div>
        </SortableContext>
        {/* Portal to <body>: DragOverlay is `position: fixed`, but the same
            transformed ancestors that displaced the context menu (.pb-leftpanel
            + PanelAnimator) re-anchor `fixed` to their own box, so the drag
            preview rides offset from the cursor. Escaping to <body> restores
            viewport coords. Context flows through the portal, so it stays wired
            to the DndContext above. */}
        {createPortal(
          <DragOverlay>
            {activeNode ? (
              <LayerRowChrome
                node={activeNode}
                depth={0}
                collapsed={!!collapsed[activeNode.key]}
                overlay
              />
            ) : null}
          </DragOverlay>,
          document.body,
        )}
      </DndContext>

      {menu &&
        view &&
        // Portal to <body>: the menu anchors to a `position: fixed` span at the
        // cursor, but `.pb-leftpanel` (motion.aside, translateX) and PanelAnimator
        // (motion.div, settles at translateX(0)) are transformed ancestors — each
        // becomes the containing block for `fixed`, so the menu would otherwise
        // land offset from the click. Escaping to <body> restores viewport coords.
        createPortal(
          <LayerContextMenu
            x={menu.x}
            y={menu.y}
            // Act on the whole multi-selection when the clicked row is part of it,
            // else just that row (in document order).
            targets={
              selectedSet.size >= 2 &&
              tree.some((n) => n.key === menu.key && selectedSet.has(n.pos))
                ? tree.filter((n) => selectedSet.has(n.pos))
                : tree.filter((n) => n.key === menu.key)
            }
            pages={tree.filter((n) => n.type === "page")}
            view={view}
            onRename={(key) => setEditingKey(key)}
            onClose={() => setMenu(null)}
          />,
          document.body,
        )}
    </TooltipProvider>
  );
}

function PanelHeader() {
  return (
    <>
      <TooltipButton
        label="Back"
        className="pb-panel-back"
        onClick={() => navigateTo("menu")}
      >
        ←
      </TooltipButton>
      <div className="pb-panel-titlebar">
        <h1 className="pb-panel-title">Layers</h1>
      </div>
    </>
  );
}

interface RowProps {
  node: LayerNode;
  view: EditorView | null;
  depth: number;
  collapsed: boolean;
  active: boolean;
  selected: boolean;
  /** This row is the container the dragged node will drop into. */
  dropTarget: boolean;
  /** Whether the in-progress drop is legal (tints the drop line + target). */
  dropValid: boolean;
  editing: boolean;
  onToggle: () => void;
  onSelect: (e: ReactMouseEvent) => void;
  onContextMenu: (e: ReactMouseEvent) => void;
  onStartRename: () => void;
  onRename: (name: string) => void;
  onCancelRename: () => void;
}

function SortableLayerRow(props: RowProps) {
  const {
    node,
    view,
    depth,
    collapsed,
    active,
    selected,
    dropTarget,
    dropValid,
    editing,
    onToggle,
    onSelect,
    onContextMenu,
    onStartRename,
    onRename,
    onCancelRename,
  } = props;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: node.key,
      // Header/footer can't be dragged (their slot is schema-fixed), but they
      // stay drop targets so blocks can move into them. Renaming disables drag.
      disabled: { draggable: !node.canDrag || editing, droppable: false },
    });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition: transition ?? undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-layer-key={node.key}
      {...attributes}
      {...listeners}
      onPointerEnter={() => view && setLayerHover(view, node.pos)}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      onDoubleClick={(e: ReactMouseEvent) => {
        e.stopPropagation();
        onStartRename();
      }}
    >
      <LayerRowChrome
        node={node}
        depth={depth}
        collapsed={collapsed}
        active={active}
        selected={selected}
        editing={editing}
        dragging={isDragging}
        dropTarget={dropTarget}
        dropValid={dropValid}
        onToggle={onToggle}
        onRename={onRename}
        onCancelRename={onCancelRename}
      />
    </div>
  );
}

/** The visual row — shared by the live list and the drag overlay. */
function LayerRowChrome({
  node,
  depth,
  collapsed,
  active,
  selected,
  editing,
  dragging,
  overlay,
  dropTarget,
  dropValid,
  onToggle,
  onRename,
  onCancelRename,
}: {
  node: LayerNode;
  depth: number;
  collapsed: boolean;
  active?: boolean;
  selected?: boolean;
  editing?: boolean;
  dragging?: boolean;
  overlay?: boolean;
  dropTarget?: boolean;
  dropValid?: boolean;
  onToggle?: () => void;
  onRename?: (name: string) => void;
  onCancelRename?: () => void;
}) {
  // While dragging, the in-place row becomes the insertion indicator — a thin
  // line at the projected depth, tinted by validity. The real row content rides
  // in the DragOverlay, so the slot reads as "this is where it lands".
  if (dragging) {
    return (
      <div
        className={`pb-layer-dropline${dropValid === false ? " -invalid" : ""}`}
        style={{ "--pb-layer-depth": depth } as React.CSSProperties}
      >
        <span className="pb-layer-dropline-bar" />
      </div>
    );
  }

  const Icon = iconFor(node.type, node.level);
  const classes = ["pb-layer-row"];
  if (active) classes.push("-active");
  if (selected) classes.push("-selected");
  if (overlay) classes.push("-overlay");
  // Site-wide master bar — purple-tinted, with a pin badge.
  if (node.isGlobalBar) classes.push("-global");
  // The container the dragged node will drop into — highlight it (red if the
  // drop is illegal), Figma-style.
  if (dropTarget) classes.push(dropValid ? "-drop-into" : "-drop-into -invalid");

  return (
    <div
      className={classes.join(" ")}
      style={{ "--pb-layer-depth": depth } as React.CSSProperties}
      data-type={node.type}
    >
      {node.hasChildren ? (
        <button
          type="button"
          className="pb-layer-caret"
          data-collapsed={collapsed || undefined}
          aria-label={collapsed ? "Expand" : "Collapse"}
          onClick={(e: ReactMouseEvent) => {
            e.stopPropagation();
            onToggle?.();
          }}
          // Don't let the caret start a drag.
          onPointerDown={(e) => e.stopPropagation()}
        >
          <CaretRight size={11} weight="bold" />
        </button>
      ) : (
        <span className="pb-layer-caret -leaf" />
      )}
      <Icon size={15} weight="regular" />
      {editing ? (
        <LayerRenameInput
          initial={node.rawName}
          placeholder={node.label}
          onCommit={(v) => onRename?.(v)}
          onCancel={() => onCancelRename?.()}
        />
      ) : (
        // Auto-derived labels (no custom `name`) read muted; an explicit name
        // shows solid — so you can tell a reflected-from-content label from one
        // you set, and renaming never feels like editing the content itself.
        <span
          className={`pb-layer-label${node.rawName.trim() ? "" : " -auto"}`}
        >
          {node.label}
        </span>
      )}
      {node.isGlobalBar && !editing && (
        <PushPin
          className="pb-layer-global-pin"
          size={12}
          weight="fill"
          aria-label="Global"
        />
      )}
    </div>
  );
}

function LayerRenameInput({
  initial,
  placeholder,
  onCommit,
  onCancel,
}: {
  initial: string;
  placeholder: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const committed = useRef(false);

  const commit = () => {
    if (committed.current) return;
    committed.current = true;
    onCommit(value);
  };

  return (
    <input
      className="pb-layer-rename"
      value={value}
      placeholder={placeholder}
      autoFocus
      onFocusCapture={(e) => e.currentTarget.select()}
      onChange={(e) => setValue(e.target.value)}
      onClick={(e: ReactMouseEvent) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onBlur={commit}
      onKeyDown={(e: ReactKeyboardEvent) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          committed.current = true;
          onCancel();
        }
      }}
    />
  );
}

// ────────────────────────────────────────────────────────────────
// Row context menu — Radix dropdown anchored at the cursor, mirroring the
// canvas BlockContextMenu's primitives/classes. Actions adapt to the target:
// page (rename/duplicate/delete), global bar (rename), block/section
// (rename/duplicate/wrap/ungroup/move-to-page/delete), or a multi-selection
// (group/delete N). Structural + block commands come from blockCommands so the
// canvas and tree stay in sync.
// ────────────────────────────────────────────────────────────────

function MenuItem({
  icon,
  label,
  destructive,
  onSelect,
}: {
  icon?: ReactNode;
  label: string;
  destructive?: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenu.Item
      className={`pb-context-menu-item${destructive ? " -destructive" : ""}`}
      onSelect={onSelect}
    >
      {icon}
      <span className="pb-context-menu-label">{label}</span>
    </DropdownMenu.Item>
  );
}

function MenuSub({
  icon,
  label,
  children,
}: {
  icon?: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger className="pb-context-menu-item">
        {icon}
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

const MenuSeparator = () => (
  <DropdownMenu.Separator className="pb-context-menu-separator" />
);

function LayerContextMenu({
  x,
  y,
  targets,
  pages,
  view,
  onRename,
  onClose,
}: {
  x: number;
  y: number;
  targets: LayerNode[];
  pages: LayerNode[];
  view: EditorView;
  onRename: (key: string) => void;
  onClose: () => void;
}) {
  if (!targets.length) return null;
  const multi = targets.length > 1;
  const node = targets[0]!;
  const positions = targets.map((t) => t.pos);

  const isPage = node.type === "page";
  const isGlobal = !!node.isGlobalBar;
  const isStructural =
    node.type === "section" || node.type === "header" || node.type === "footer";
  const isGroup = GROUP_TYPES.has(node.type);
  // A section/structural row can't be deleted if it's its parent's only child
  // (a page needs `section+`); blocks can always go.
  const deletable =
    !isStructural || view.state.doc.resolve(node.pos).parent.childCount > 1;
  const canGroupMulti = multi && sharedParent(view.state, positions) != null;
  const otherPages = pages.filter((p) => p.pageId && p.pageId !== node.pageId);

  /** Run a command, then close. */
  const run = (fn: () => void) => () => {
    fn();
    onClose();
  };

  return (
    <DropdownMenu.Root open onOpenChange={(open) => !open && onClose()} modal={false}>
      <DropdownMenu.Trigger asChild>
        <span
          aria-hidden
          style={{ position: "fixed", top: y, left: x, width: 0, height: 0 }}
        />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="pb-context-menu"
          side="bottom"
          align="start"
          sideOffset={2}
          collisionPadding={8}
        >
          {multi ? (
            <>
              {canGroupMulti && (
                <MenuSub
                  label="Group"
                  icon={<StackSimple size={15} weight="regular" />}
                >
                  <MenuItem
                    label="Container"
                    icon={<StackSimple size={15} weight="regular" />}
                    onSelect={run(() => groupBlocks(view, positions, "container"))}
                  />
                  <MenuItem
                    label="Row"
                    icon={<Rows size={15} weight="regular" />}
                    onSelect={run(() => groupBlocks(view, positions, "row"))}
                  />
                </MenuSub>
              )}
              {canGroupMulti && <MenuSeparator />}
              <MenuItem
                destructive
                label={`Delete ${positions.length} layers`}
                icon={<Trash size={15} weight="regular" />}
                onSelect={run(() => deleteBlocks(view, positions))}
              />
            </>
          ) : isPage ? (
            <>
              <MenuItem
                label="Rename"
                icon={<PencilSimple size={15} weight="regular" />}
                onSelect={run(() => onRename(node.key))}
              />
              <MenuItem
                label="Duplicate"
                icon={<Copy size={15} weight="regular" />}
                onSelect={run(() => duplicatePage(view, node.pageId))}
              />
              <MenuSeparator />
              <MenuItem
                destructive
                label="Delete"
                icon={<Trash size={15} weight="regular" />}
                onSelect={run(() => deletePage(view, node.pageId))}
              />
            </>
          ) : isGlobal ? (
            <MenuItem
              label="Rename"
              icon={<PencilSimple size={15} weight="regular" />}
              onSelect={run(() => onRename(node.key))}
            />
          ) : (
            <>
              <MenuItem
                label="Rename"
                icon={<PencilSimple size={15} weight="regular" />}
                onSelect={run(() => onRename(node.key))}
              />
              <MenuItem
                label="Duplicate"
                icon={<Copy size={15} weight="regular" />}
                onSelect={run(() => duplicateBlock(view, node.pos))}
              />
              {!isStructural && (
                <MenuSub
                  label="Wrap in"
                  icon={<StackSimple size={15} weight="regular" />}
                >
                  <MenuItem
                    label="Container"
                    icon={<StackSimple size={15} weight="regular" />}
                    onSelect={run(() => groupBlocks(view, [node.pos], "container"))}
                  />
                  <MenuItem
                    label="Card"
                    icon={<Cards size={15} weight="regular" />}
                    onSelect={run(() => groupBlocks(view, [node.pos], "card"))}
                  />
                  <MenuItem
                    label="Row"
                    icon={<Rows size={15} weight="regular" />}
                    onSelect={run(() => groupBlocks(view, [node.pos], "row"))}
                  />
                </MenuSub>
              )}
              {isGroup && (
                <MenuItem
                  label="Ungroup"
                  icon={<FrameCorners size={15} weight="regular" />}
                  onSelect={run(() => ungroupBlock(view, node.pos))}
                />
              )}
              {otherPages.length > 0 && (
                <MenuSub
                  label="Move to page"
                  icon={<ArrowRight size={15} weight="regular" />}
                >
                  {otherPages.map((p) => (
                    <MenuItem
                      key={p.key}
                      label={p.label}
                      onSelect={run(() => moveNodeToPage(view, node.pos, p.pageId))}
                    />
                  ))}
                </MenuSub>
              )}
              {deletable && (
                <>
                  <MenuSeparator />
                  <MenuItem
                    destructive
                    label="Delete"
                    icon={<Trash size={15} weight="regular" />}
                    onSelect={run(() => deleteBlocks(view, [node.pos]))}
                  />
                </>
              )}
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
