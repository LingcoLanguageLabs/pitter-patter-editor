/**
 * Pages panel — the slide navigator (Slides / PowerPoint filmstrip).
 *
 * A vertical list of numbered slide cards: click to switch, drag to
 * reorder, hover for duplicate / delete, "+" to add. Cards show a cached
 * snapshot thumbnail (or the slide title until one is generated) in a 16:9
 * frame.
 *
 * Multi-select mirrors Google Slides: ⌘/Ctrl-click toggles a page in the
 * selection, Shift-click extends a range from the anchor, a plain click
 * resets to one. The right-click menu adapts — a single page offers New /
 * Duplicate / Split into Pages / Move / Delete; two-or-more offer Duplicate,
 * Merge (gather every section onto one page), and Delete. Selection is local
 * UI state; the active (canvas) page is always the last one clicked.
 *
 * Reordering uses @dnd-kit/sortable — a pointer sensor with a small
 * activation distance so a plain click still switches slides, plus a
 * DragOverlay for the lifted card. On drop we translate the post-drop order
 * into a single `movePage` call (insert-before-neighbour) so the ProseMirror
 * doc stays the source of truth and the rail re-mirrors from it.
 *
 * Lives outside the ProseMirror context, so it reads the deck from the
 * store (mirrored by `PagesSync`) and dispatches through the stashed view.
 */

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
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
  Copy,
  Plus,
  Rows,
  Stack,
  Trash,
} from "@phosphor-icons/react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { EditorView } from "prosemirror-view";
import { useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";

import { pageList, setActivePage } from "../activePagePlugin";
import {
  addPage,
  deletePage,
  deletePages,
  duplicatePage,
  duplicatePages,
  mergePages,
  movePage,
  movePageToEnd,
  movePageToStart,
  splitPageSections,
} from "../pageCommands";
import { PageThumbnail } from "../PageThumbnail";
import { navigateTo, usePageBuilderStore, type PageMeta } from "../store";

export function PagesPanel() {
  const pages = usePageBuilderStore((s) => s.pages);
  const activeId = usePageBuilderStore((s) => s.activePageId);
  const view = usePageBuilderStore((s) => s.pagesView);

  const [dragId, setDragId] = useState<string | null>(null);
  // Right-click context menu, anchored at the cursor and targeting one page.
  const [menu, setMenu] = useState<{ x: number; y: number; pageId: string } | null>(
    null,
  );
  // Multi-selected page ids (rail highlight). Empty means "just the active
  // page" — the active page always reads its own `data-active` highlight, so
  // an empty set still shows one selected card.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  // Anchor for Shift-range selection (the last plainly-/⌘-clicked page).
  const [anchorId, setAnchorId] = useState<string | null>(null);

  /** Replace the selection (and anchor) with exactly these ids — used after a
   *  command so the rail re-selects whatever it produced. */
  const selectResult = (ids: string[]) => {
    setSelectedIds(new Set(ids));
    setAnchorId(ids[0] ?? null);
  };

  /** A click on a card: plain → select only it; ⌘/Ctrl → toggle; Shift →
   *  range from the anchor. Whatever is clicked also becomes the active
   *  (canvas) page. */
  const onCardClick = (e: ReactMouseEvent, id: string) => {
    if (!view) return;
    const anchor = anchorId ?? activeId;
    if (e.shiftKey && anchor) {
      const a = pages.findIndex((p) => p.id === anchor);
      const b = pages.findIndex((p) => p.id === id);
      if (a !== -1 && b !== -1) {
        const [lo, hi] = a < b ? [a, b] : [b, a];
        setSelectedIds(new Set(pages.slice(lo, hi + 1).map((p) => p.id)));
        setActivePage(view, id);
        return; // keep the anchor for further range extension
      }
    }
    if (e.metaKey || e.ctrlKey) {
      const next = new Set(selectedIds.size ? selectedIds : activeId ? [activeId] : []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) next.add(id); // never leave nothing selected
      setSelectedIds(next);
    } else {
      setSelectedIds(new Set([id]));
    }
    setAnchorId(id);
    setActivePage(view, id);
  };

  /** Open the context menu. Right-clicking a page outside the current
   *  multi-selection collapses the selection onto it first (Google Slides). */
  const onCardContextMenu = (e: ReactMouseEvent, id: string) => {
    e.preventDefault();
    if (!(selectedIds.size >= 2 && selectedIds.has(id))) {
      setSelectedIds(new Set([id]));
      setAnchorId(id);
    }
    setMenu({ x: e.clientX, y: e.clientY, pageId: id });
  };

  const sensors = useSensors(
    // A few px of travel before a drag starts, so a plain click still
    // switches slides instead of being swallowed as a zero-distance drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    setDragId(null);
    const { active, over } = e;
    if (!view || !over || active.id === over.id) return;
    const oldIndex = pages.findIndex((p) => p.id === active.id);
    const newIndex = pages.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    // Translate the post-drop order into one insert-before call: the dragged
    // slide should land just before whatever now follows it (null = end).
    const reordered = arrayMove(pages, oldIndex, newIndex);
    const at = reordered.findIndex((p) => p.id === active.id);
    const beforeId = reordered[at + 1]?.id ?? null;
    movePage(view, String(active.id), beforeId);
  };

  const dragged = pages.find((p) => p.id === dragId) ?? null;

  return (
    <>
      <button
        type="button"
        className="pb-panel-back"
        onClick={() => navigateTo("menu")}
        aria-label="Back"
      >
        ←
      </button>
      <div className="pb-panel-titlebar">
        <h1 className="pb-panel-title">Pages</h1>
        <button
          type="button"
          className="pb-icon-button"
          aria-label="Add page"
          title="Add page"
          disabled={!view}
          onClick={() => view && selectResult([addPage(view)])}
        >
          <Plus size={16} weight="bold" />
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={(e: DragStartEvent) => setDragId(String(e.active.id))}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDragId(null)}
      >
        <SortableContext
          items={pages.map((p) => p.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="pb-pages">
            {pages.map((page, i) => (
              <SortablePageCard
                key={page.id}
                page={page}
                index={i}
                active={page.id === activeId}
                selected={selectedIds.has(page.id)}
                canDelete={pages.length > 1}
                view={view}
                onSelect={(e) => onCardClick(e, page.id)}
                onContextMenu={(e) => onCardContextMenu(e, page.id)}
                onResult={selectResult}
              />
            ))}
          </div>
        </SortableContext>
        <DragOverlay>
          {dragged ? (
            <div
              className="pb-page-card -overlay"
              data-active={dragged.id === activeId || undefined}
            >
              <span className="pb-page-num">
                {pages.findIndex((p) => p.id === dragged.id) + 1}
              </span>
              <div className="pb-page-thumb">
                <PageThumbnail pageId={dragged.id} title={dragged.title} />
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {menu && view && (
        <PageContextMenu
          x={menu.x}
          y={menu.y}
          // The set the menu acts on: the multi-selection when the clicked
          // page is part of one (≥2), else just that page. Kept in document
          // order via `pages`.
          targetIds={
            selectedIds.size >= 2 && selectedIds.has(menu.pageId)
              ? pages.filter((p) => selectedIds.has(p.id)).map((p) => p.id)
              : [menu.pageId]
          }
          pages={pages}
          view={view}
          onResult={selectResult}
          onClose={() => setMenu(null)}
        />
      )}
    </>
  );
}

/**
 * Right-click menu for page cards. Two shapes, chosen by `targetIds`:
 *   • one page  → New Page / Duplicate Page / Split into Pages, Move to
 *                 Beginning / End, Delete
 *   • two-plus  → Duplicate Pages, Merge Pages, Delete N Pages
 * Built on Radix DropdownMenu anchored to a zero-size element at the cursor —
 * the same primitive (and CSS) as the canvas's `BlockContextMenu`. Each action
 * runs a command, re-selects whatever it produced via `onResult`, and closes.
 */
function PageContextMenu({
  x,
  y,
  targetIds,
  pages,
  view,
  onResult,
  onClose,
}: {
  x: number;
  y: number;
  targetIds: string[];
  pages: PageMeta[];
  view: EditorView;
  onResult: (ids: string[]) => void;
  onClose: () => void;
}) {
  const multi = targetIds.length > 1;
  const id = targetIds[0]!;
  const index = pages.findIndex((p) => p.id === id);
  const isFirst = index <= 0;
  const isLast = index === pages.length - 1;
  // "Split into Pages" only makes sense when the page holds ≥2 sections —
  // read live from the doc (the rail's PageMeta carries no section count).
  const sectionCount =
    pageList(view.state.doc).find((p) => p.id === id)?.node.childCount ?? 0;

  // Run a command, feed its result back to the rail's selection, then close.
  const run = (fn: () => string[]) => () => {
    onResult(fn());
    onClose();
  };

  return (
    <DropdownMenu.Root
      open
      onOpenChange={(open) => !open && onClose()}
      modal={false}
    >
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
              <MenuItem
                icon={<Copy size={15} weight="regular" />}
                label="Duplicate Pages"
                onSelect={run(() => duplicatePages(view, targetIds))}
              />
              <MenuItem
                icon={<Stack size={15} weight="regular" />}
                label="Merge Pages"
                onSelect={run(() => {
                  const merged = mergePages(view, targetIds);
                  return merged ? [merged] : [];
                })}
              />
              <Separator />
              <MenuItem
                destructive
                icon={<Trash size={15} weight="regular" />}
                label={`Delete ${targetIds.length} Pages`}
                onSelect={run(() => {
                  const survivor = deletePages(view, targetIds);
                  return survivor ? [survivor] : [];
                })}
              />
            </>
          ) : (
            <>
              <MenuItem
                icon={<Plus size={15} weight="regular" />}
                label="New Page"
                onSelect={run(() => [addPage(view, id)])}
              />
              <MenuItem
                icon={<Copy size={15} weight="regular" />}
                label="Duplicate Page"
                onSelect={run(() => [duplicatePage(view, id)])}
              />
              {sectionCount >= 2 && (
                <MenuItem
                  icon={<Rows size={15} weight="regular" />}
                  label="Split into Pages"
                  onSelect={run(() => splitPageSections(view, id))}
                />
              )}
              <Separator />
              <MenuItem
                icon={<ArrowLineUp size={15} weight="regular" />}
                label="Move to Beginning"
                disabled={isFirst}
                onSelect={run(() => {
                  movePageToStart(view, id);
                  return [id];
                })}
              />
              <MenuItem
                icon={<ArrowLineDown size={15} weight="regular" />}
                label="Move to End"
                disabled={isLast}
                onSelect={run(() => {
                  movePageToEnd(view, id);
                  return [id];
                })}
              />
              <Separator />
              <MenuItem
                destructive
                icon={<Trash size={15} weight="regular" />}
                label="Delete"
                disabled={pages.length <= 1}
                onSelect={run(() => {
                  const survivor = deletePage(view, id);
                  return survivor ? [survivor] : [];
                })}
              />
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function MenuItem({
  icon,
  label,
  destructive,
  disabled,
  onSelect,
}: {
  icon?: ReactNode;
  label: string;
  destructive?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenu.Item
      className={`pb-context-menu-item${destructive ? " -destructive" : ""}`}
      disabled={disabled}
      onSelect={onSelect}
    >
      {icon}
      <span className="pb-context-menu-label">{label}</span>
    </DropdownMenu.Item>
  );
}

const Separator = () => (
  <DropdownMenu.Separator className="pb-context-menu-separator" />
);

/**
 * One draggable slide card. Split out because `useSortable` is a hook and
 * must run per item. The whole card is the drag handle (pointer sensor with
 * a small activation distance keeps clicks working); action buttons stop
 * pointer/​click propagation so they don't initiate a drag or switch slides.
 */
function SortablePageCard({
  page,
  index,
  active,
  selected,
  canDelete,
  view,
  onSelect,
  onContextMenu,
  onResult,
}: {
  page: PageMeta;
  index: number;
  active: boolean;
  selected: boolean;
  canDelete: boolean;
  view: EditorView | null;
  onSelect: (e: ReactMouseEvent) => void;
  onContextMenu: (e: ReactMouseEvent) => void;
  onResult: (ids: string[]) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: page.id });

  return (
    <div
      ref={setNodeRef}
      className="pb-page-card"
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-active={active || undefined}
      data-selected={selected || undefined}
      data-dragging={isDragging || undefined}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      {...attributes}
      {...listeners}
    >
      <span className="pb-page-num">{index + 1}</span>
      <div className="pb-page-thumb">
        <PageThumbnail pageId={page.id} title={page.title} />
      </div>
      <div className="pb-page-actions">
        <button
          type="button"
          className="pb-page-action"
          aria-label="Duplicate slide"
          title="Duplicate"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            if (view) onResult([duplicatePage(view, page.id)]);
          }}
        >
          <Copy size={13} weight="regular" />
        </button>
        <button
          type="button"
          className="pb-page-action -danger"
          aria-label="Delete slide"
          title="Delete"
          disabled={!canDelete}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            if (!view) return;
            const survivor = deletePage(view, page.id);
            onResult(survivor ? [survivor] : []);
          }}
        >
          <Trash size={13} weight="regular" />
        </button>
      </div>
    </div>
  );
}
