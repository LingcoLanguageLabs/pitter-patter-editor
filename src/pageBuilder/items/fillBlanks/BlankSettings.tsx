/**
 * Fill Blanks — the blank settings panel (rendered in the chip's popover; same
 * pattern as the block menu). Switch a blank between Text (typed) and Dropdown,
 * edit the answer + alternative accepted answers, and for dropdowns manage
 * choices: mark the correct one, add / remove, and drag to reorder (dnd-kit
 * sortable). Remove reverts to plain text.
 */

import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DotsSixVertical, Trash } from "@phosphor-icons/react";

import { Field, Segmented } from "../shared/controls";
import { newId } from "../shared/ids";
import { LiveInput, StringListEditor } from "./fields";
import type { BlankOption } from "./schema";

interface BlankSettingsProps {
  mode: string;
  options: BlankOption[];
  answerId: string;
  alternates: string[];
  update: (patch: Record<string, unknown>) => void;
  remove: () => void;
}

export function BlankSettings({
  mode,
  options,
  answerId,
  alternates,
  update,
  remove,
}: BlankSettingsProps) {
  const setOptionText = (id: string, text: string) =>
    update({ options: options.map((o) => (o.id === id ? { ...o, text } : o)) });

  const addOption = () =>
    update({ options: [...options, { id: newId("opt"), text: "" }] });

  const removeOption = (id: string) => {
    if (options.length <= 1) return;
    const next = options.filter((o) => o.id !== id);
    update({
      options: next,
      answerId: answerId === id ? (next[0]?.id ?? "") : answerId,
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = options.findIndex((o) => o.id === active.id);
    const to = options.findIndex((o) => o.id === over.id);
    if (from < 0 || to < 0) return;
    update({ options: arrayMove(options, from, to) });
  };

  const answerText =
    options.find((o) => o.id === answerId)?.text ?? options[0]?.text ?? "";

  return (
    <div className="pp-blank-settings">
      <Field label="Type">
        <Segmented
          ariaLabel="Blank type"
          value={mode === "dropdown" ? "dropdown" : "text"}
          options={[
            { value: "text", label: "Text" },
            { value: "dropdown", label: "Dropdown" },
          ]}
          onChange={(m) => update({ mode: m })}
        />
      </Field>

      {mode === "dropdown" ? (
        <Field label="Options (pick the correct one)">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={options.map((o) => o.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="pp-blank-options">
                {options.map((o) => (
                  <SortableOption
                    key={o.id}
                    option={o}
                    correct={o.id === answerId}
                    canRemove={options.length > 1}
                    onText={(t) => setOptionText(o.id, t)}
                    onCorrect={() => update({ answerId: o.id })}
                    onRemove={() => removeOption(o.id)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
          <button
            type="button"
            className="pp-blank-add-option"
            onClick={addOption}
          >
            + Add option
          </button>
        </Field>
      ) : (
        <>
          <Field label="Answer">
            <LiveInput
              value={answerText}
              placeholder="Correct answer"
              onChange={(t) => {
                const id = answerId || options[0]?.id;
                if (id) setOptionText(id, t);
              }}
            />
          </Field>
          <Field label="Alternative answers">
            <StringListEditor
              values={alternates}
              onChange={(next) => update({ alternates: next })}
              placeholder="Also accepted"
              addLabel="+ Add alternative"
            />
          </Field>
        </>
      )}

      <button type="button" className="pp-blank-remove" onClick={remove}>
        Remove blank
      </button>
    </div>
  );
}

/** A sortable dropdown option row: drag handle + correct-radio + text + delete. */
function SortableOption({
  option,
  correct,
  canRemove,
  onText,
  onCorrect,
  onRemove,
}: {
  option: BlankOption;
  correct: boolean;
  canRemove: boolean;
  onText: (t: string) => void;
  onCorrect: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: option.id });
  return (
    <li
      ref={setNodeRef}
      className="pp-blank-option"
      data-dragging={isDragging || undefined}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        type="button"
        className="pp-blank-option-handle"
        aria-label="Reorder"
        {...attributes}
        {...listeners}
      >
        <DotsSixVertical size={14} weight="bold" />
      </button>
      <input
        type="radio"
        checked={correct}
        onChange={onCorrect}
        aria-label="Mark as correct"
        className="pp-blank-option-radio"
      />
      <LiveInput value={option.text} placeholder="Option" onChange={onText} />
      <button
        type="button"
        className="pp-blank-option-delete"
        onClick={onRemove}
        disabled={!canRemove}
        aria-label="Delete option"
      >
        <Trash size={13} weight="bold" />
      </button>
    </li>
  );
}
