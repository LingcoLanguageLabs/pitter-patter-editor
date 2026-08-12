/**
 * Fill Blanks — small shared form inputs used by both settings surfaces:
 *   • LiveInput        — text input with local state so committing to the doc
 *                        doesn't jump the caret; re-syncs on external change.
 *   • StringListEditor — add / edit / remove a `string[]` (no reorder — order is
 *                        irrelevant for alternates + distractors). Reuses the
 *                        `.pp-blank-option*` styling from the dropdown options.
 */

import { Trash } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

export function LiveInput({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder?: string;
  onChange: (t: string) => void;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => {
    setLocal(value);
  }, [value]);
  return (
    <input
      type="text"
      className="pb-text-input pp-blank-input"
      value={local}
      placeholder={placeholder}
      onChange={(e) => {
        setLocal(e.target.value);
        onChange(e.target.value);
      }}
    />
  );
}

export function StringListEditor({
  values,
  onChange,
  placeholder,
  addLabel,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  addLabel: string;
}) {
  const setAt = (i: number, text: string) =>
    onChange(values.map((v, j) => (j === i ? text : v)));
  const removeAt = (i: number) => onChange(values.filter((_, j) => j !== i));
  const add = () => onChange([...values, ""]);

  return (
    <>
      {values.length > 0 && (
        <ul className="pp-blank-options">
          {values.map((v, i) => (
            // Index keys are fine here: rows aren't reordered, and LiveInput
            // re-syncs its local value when the list shifts after a remove.
            <li key={i} className="pp-blank-option">
              <LiveInput
                value={v}
                placeholder={placeholder}
                onChange={(t) => setAt(i, t)}
              />
              <button
                type="button"
                className="pp-blank-option-delete"
                onClick={() => removeAt(i)}
                aria-label="Remove"
              >
                <Trash size={13} weight="bold" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="pp-blank-add-option" onClick={add}>
        {addLabel}
      </button>
    </>
  );
}
