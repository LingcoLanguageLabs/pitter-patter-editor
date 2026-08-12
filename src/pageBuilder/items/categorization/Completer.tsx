/**
 * Categorization — completer (student-facing). Pure React over the typed
 * `CategorizationDef`; owns its own response state (`placement`: card id →
 * category id). Two presentations, chosen by `def.display`:
 *
 *   • grid   — dnd-kit. An "Items" pool of shuffled cards + one drop zone per
 *              category. Drag cards into buckets (and back). Mirrors Fill
 *              Blanks' word-bank dnd-kit setup.
 *   • matrix — a table: one row per item, one column per category, a radio in
 *              each cell. No dragging.
 *
 * No own Check button — an official Check button grades it via the shared
 * grading store (`useItemGrading`): the `placement` is persisted by `itemId`
 * (survives page nav), feedback shows once graded, and editing clears it.
 */

import {
  closestCenter,
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useMemo, useState, type ReactNode } from "react";

import { ItemFeedback } from "../shared/Feedback";
import { useRenderBlocks } from "../shared/blockRenderer";
import { useItemGrading } from "../shared/grading";
import { renderInline } from "../shared/renderInline";
import type { CompleterProps } from "../types";
import {
  categorizationPerItem,
  gradeCategorization,
  POOL_ID,
  type CatPlacement,
} from "./grade";
import type { CategorizationDef } from "./serialize";

export function CategorizationCompleter({
  def,
}: CompleterProps<CategorizationDef>) {
  return def.display === "matrix" ? (
    <MatrixCategorization def={def} />
  ) : (
    <GridCategorization def={def} />
  );
}

/** Fisher–Yates shuffle (new array) — used once per mount so the pool order is
 *  mixed but stable through the session. */
function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

type ItemFeedback = "correct" | "incorrect" | undefined;
function itemState(
  perItem: Record<string, boolean> | null,
  cardId: string,
): ItemFeedback {
  if (!perItem) return undefined;
  return perItem[cardId] ? "correct" : "incorrect";
}

// ── Grid mode: drag cards into category buckets ──────────────────────
function GridCategorization({ def }: { def: CategorizationDef }) {
  const renderBlocks = useRenderBlocks();
  const order = useMemo(() => shuffle(def.items.map((i) => i.id)), [def]);
  const cardById = useMemo(
    () => Object.fromEntries(def.items.map((i) => [i.id, i])),
    [def],
  );
  const { graded, initialResponse, persist, reset } = useItemGrading(def.itemId);
  const [placement, setPlacement] = useState<CatPlacement>(
    () => (initialResponse as CatPlacement) ?? {},
  );
  const perItem = useMemo(
    () => (graded ? categorizationPerItem(def, placement) : null),
    [graded, def, placement],
  );
  const result = useMemo(
    () => (graded ? gradeCategorization(def, placement) : null),
    [graded, def, placement],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    const cardId = String(e.active.id);
    const over = e.over ? String(e.over.id) : null;
    if (!over || !over.startsWith("zone:")) return;
    const target = over.slice(5);
    setPlacement((prev) => {
      const next = { ...prev };
      if (target === POOL_ID) delete next[cardId];
      else next[cardId] = target;
      persist(next); // moving a card clears this prompt's graded flag
      return next;
    });
  };

  // Cards still in the pool = those without a (real) placement, in shuffled order.
  const poolCardIds = order.filter((id) => {
    const p = placement[id];
    return !p || p === POOL_ID;
  });
  const cardIdsFor = (categoryId: string) =>
    order.filter((id) => placement[id] === categoryId);

  const renderCard = (cardId: string) => {
    const card = cardById[cardId];
    if (!card) return null;
    return (
      <DraggableCard key={cardId} id={cardId} state={itemState(perItem, cardId)}>
        {renderInline(card.content)}
      </DraggableCard>
    );
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <div className="pp-cat-completer" data-display="grid">
        <div className="pp-cat-completer-prompt">{renderBlocks(def.prompt)}</div>
        <DropZone id={POOL_ID} className="pp-cat-pool" label="Items">
          {poolCardIds.map(renderCard)}
          {poolCardIds.length === 0 && (
            <span className="pp-cat-pool-empty">All items sorted</span>
          )}
        </DropZone>
        <div className="pp-cat-buckets">
          {def.categories.map((c) => (
            <DropZone
              key={c.id}
              id={c.id}
              className="pp-cat-bucket"
              label={c.name || "Untitled"}
            >
              {cardIdsFor(c.id).map(renderCard)}
            </DropZone>
          ))}
        </div>
        {result && (
          <ItemFeedback
            status={result.status}
            feedback={def.feedback}
            explanation={def.explanation}
            onTryAgain={reset}
          />
        )}
      </div>
    </DndContext>
  );
}

function DraggableCard({
  id,
  state,
  children,
}: {
  id: string;
  state: ItemFeedback;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id });
  return (
    <button
      ref={setNodeRef}
      type="button"
      className="pp-cat-card"
      data-dragging={isDragging || undefined}
      data-state={state}
      style={{ transform: CSS.Translate.toString(transform) }}
      {...attributes}
      {...listeners}
    >
      {children}
    </button>
  );
}

function DropZone({
  id,
  className,
  label,
  children,
}: {
  id: string;
  className: string;
  label: string;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `zone:${id}` });
  return (
    <div ref={setNodeRef} className={className} data-over={isOver || undefined}>
      <span className="pp-cat-zone-label">{label}</span>
      <div className="pp-cat-zone-cards">{children}</div>
    </div>
  );
}

// ── Matrix mode: a radio per (item, category) ────────────────────────
function MatrixCategorization({ def }: { def: CategorizationDef }) {
  const renderBlocks = useRenderBlocks();
  const { graded, initialResponse, persist, reset } = useItemGrading(def.itemId);
  const [placement, setPlacement] = useState<CatPlacement>(
    () => (initialResponse as CatPlacement) ?? {},
  );
  const perItem = useMemo(
    () => (graded ? categorizationPerItem(def, placement) : null),
    [graded, def, placement],
  );
  const result = useMemo(
    () => (graded ? gradeCategorization(def, placement) : null),
    [graded, def, placement],
  );

  const pick = (cardId: string, categoryId: string) => {
    setPlacement((prev) => {
      const next = { ...prev, [cardId]: categoryId };
      persist(next); // picking clears this prompt's graded flag
      return next;
    });
  };

  return (
    <div className="pp-cat-completer" data-display="matrix">
      <div className="pp-cat-completer-prompt">{renderBlocks(def.prompt)}</div>
      <div className="pp-cat-matrix-scroll">
        <table className="pp-cat-matrix">
          <thead>
            <tr>
              <th />
              {def.categories.map((c) => (
                <th key={c.id} scope="col">
                  {c.name || "Untitled"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {def.items.map((item) => (
              <tr key={item.id} data-state={itemState(perItem, item.id)}>
                <th scope="row" className="pp-cat-matrix-item">
                  {renderInline(item.content)}
                </th>
                {def.categories.map((c) => (
                  <td key={c.id}>
                    <input
                      type="radio"
                      name={`cat-${def.itemId}-${item.id}`}
                      checked={placement[item.id] === c.id}
                      onChange={() => pick(item.id, c.id)}
                      aria-label={c.name || "Untitled"}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {result && (
        <ItemFeedback
          status={result.status}
          feedback={def.feedback}
          explanation={def.explanation}
          onTryAgain={reset}
        />
      )}
    </div>
  );
}

