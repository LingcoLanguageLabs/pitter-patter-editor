/**
 * Fill Blanks — completer (student-facing). Renders the stem through the shared
 * block walker (so media/paragraphs render normally) and provides an inline-item
 * renderer so each `blank` becomes an interactive control:
 *   • Inline mode    — a text input or a dropdown per blank.
 *   • Word-bank mode — every blank is a drop zone; a shared bank of draggable
 *                      words (dnd-kit) is filled by dragging. Words move between
 *                      bank and blanks.
 * No own Check button — an official Check button grades it via the shared
 * grading store (`useItemGrading`): the response (typed values / word placement)
 * is persisted by `itemId` so it survives page nav; feedback shows when the
 * store has graded this prompt, and editing clears it.
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
import { InlineItemProvider, type RenderInlineItem } from "../shared/inlineItems";
import type { CompleterProps } from "../types";
import { fillBlanksPerBlank, gradeFillBlanks, type FbResponse } from "./grade";
import { blankDefFromNode, type FillBlanksDef } from "./serialize";

export function FillBlanksCompleter({ def }: CompleterProps<FillBlanksDef>) {
  return def.wordBank ? <WordBankFb def={def} /> : <InlineFb def={def} />;
}

// ── Inline mode: text input / dropdown per blank ─────────────────────
function InlineFb({ def }: { def: FillBlanksDef }) {
  const renderBlocks = useRenderBlocks();
  const { graded, initialResponse, persist, reset } = useItemGrading(def.itemId);
  const [values, setValues] = useState<FbResponse>(
    () => (initialResponse as FbResponse) ?? {},
  );
  const perBlank = useMemo(
    () => (graded ? fillBlanksPerBlank(def, values) : null),
    [graded, def, values],
  );
  const result = useMemo(
    () => (graded ? gradeFillBlanks(def, values) : null),
    [graded, def, values],
  );

  const renderBlank: RenderInlineItem = (node) => {
    const b = blankDefFromNode(node);
    const value = values[b.blankId] ?? "";
    const state = blankState(perBlank, b.blankId);
    // Editing persists a new response, which clears this prompt's graded flag.
    const onChange = (v: string) =>
      setValues((prev) => {
        const next = { ...prev, [b.blankId]: v };
        persist(next);
        return next;
      });
    if (b.mode === "dropdown") {
      return (
        <select
          className="pp-blank-field"
          data-state={state}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="" disabled>
            —
          </option>
          {b.options.map((o) => (
            <option key={o.id} value={o.text}>
              {o.text}
            </option>
          ))}
        </select>
      );
    }
    return (
      <input
        type="text"
        className="pp-blank-field"
        data-state={state}
        value={value}
        size={Math.max(b.answer.length, 6)}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  };

  return (
    <div className="pp-fb-completer">
      <InlineItemProvider value={renderBlank}>
        <div className="pp-fb-completer-stem">{renderBlocks(def.stem)}</div>
      </InlineItemProvider>
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

// ── Word-bank mode: drag shared words into blank drop zones ──────────
interface WordInstance {
  id: string;
  text: string;
}

/** Fisher–Yates shuffle (returns a new array). Used once per mount so the bank
 *  order — answers + distractors — is mixed but stable through the session. */
function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function WordBankFb({ def }: { def: FillBlanksDef }) {
  const renderBlocks = useRenderBlocks();
  const { graded, initialResponse, persist, reset } = useItemGrading(def.itemId);
  // The bank = one word per blank (its answer; blankId doubles as the stable
  // word id) PLUS any distractors (no matching blank → wrong if placed). Shuffle
  // once per mount so distractors aren't obviously trailing.
  const words = useMemo<WordInstance[]>(() => {
    const answers = def.blanks.map((b) => ({ id: b.blankId, text: b.answer }));
    const distractors = (def.bankDistractors ?? [])
      .filter((text) => text.trim())
      .map((text, i) => ({ id: `distractor-${i}`, text }));
    return shuffle([...answers, ...distractors]);
  }, [def]);
  const wordText = useMemo(
    () => Object.fromEntries(words.map((w) => [w.id, w.text])),
    [words],
  );
  // The persisted response IS the placement (blankId → wordId), so it round-trips
  // across page nav.
  const [placement, setPlacement] = useState<Record<string, string>>(
    () => (initialResponse as Record<string, string>) ?? {},
  );

  const response: FbResponse = {};
  for (const b of def.blanks) {
    const wid = placement[b.blankId];
    if (wid) response[b.blankId] = wordText[wid] ?? "";
  }
  const perBlank = graded ? fillBlanksPerBlank(def, response) : null;
  const result = graded ? gradeFillBlanks(def, response) : null;

  const placed = new Set(Object.values(placement));
  const bankWords = words.filter((w) => !placed.has(w.id));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    const wordId = String(e.active.id);
    const over = e.over ? String(e.over.id) : null;
    setPlacement((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) if (next[k] === wordId) delete next[k];
      if (over && over.startsWith("blank:")) next[over.slice(6)] = wordId;
      persist(next); // dropping clears this prompt's graded flag
      return next;
    });
  };

  const renderBlank: RenderInlineItem = (node) => {
    const b = blankDefFromNode(node);
    const wid = placement[b.blankId];
    return (
      <BlankDropZone
        blankId={b.blankId}
        state={blankState(perBlank, b.blankId)}
        word={wid ? { id: wid, text: wordText[wid] ?? "" } : null}
      />
    );
  };

  const bank = (
    <Bank>
      {bankWords.map((w) => (
        <DraggableWord key={w.id} id={w.id} text={w.text} />
      ))}
      {bankWords.length === 0 && (
        <span className="pp-fb-bank-empty">All words placed</span>
      )}
    </Bank>
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <div className="pp-fb-completer">
        {def.bankPosition === "top" && bank}
        <InlineItemProvider value={renderBlank}>
          <div className="pp-fb-completer-stem">{renderBlocks(def.stem)}</div>
        </InlineItemProvider>
        {def.bankPosition !== "top" && bank}
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

function DraggableWord({ id, text }: { id: string; text: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id });
  return (
    <button
      ref={setNodeRef}
      type="button"
      className="pp-fb-word"
      data-dragging={isDragging || undefined}
      style={{ transform: CSS.Translate.toString(transform) }}
      {...attributes}
      {...listeners}
    >
      {text}
    </button>
  );
}

function BlankDropZone({
  blankId,
  word,
  state,
}: {
  blankId: string;
  word: WordInstance | null;
  state: BlankFeedback;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `blank:${blankId}` });
  return (
    <span
      ref={setNodeRef}
      className="pp-fb-dropzone"
      data-over={isOver || undefined}
      data-filled={!!word || undefined}
      data-state={state}
    >
      {word ? (
        <DraggableWord id={word.id} text={word.text} />
      ) : (
        <span className="pp-fb-dropzone-gap" />
      )}
    </span>
  );
}

function Bank({ children }: { children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: "bank" });
  return (
    <div ref={setNodeRef} className="pp-fb-bank" data-over={isOver || undefined}>
      <span className="pp-fb-bank-label">Word bank</span>
      <div className="pp-fb-bank-words">{children}</div>
    </div>
  );
}

// ── Shared footer ────────────────────────────────────────────────────
type BlankFeedback = "correct" | "incorrect" | undefined;
function blankState(
  perBlank: Record<string, boolean> | null,
  blankId: string,
): BlankFeedback {
  if (!perBlank) return undefined;
  return perBlank[blankId] ? "correct" : "incorrect";
}
