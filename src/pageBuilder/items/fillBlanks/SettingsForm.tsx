/**
 * Fill Blanks — block-menu settings (registered via the ItemDefinition, read by
 * BlockSettings from the registry). Points + the question-level answer mode:
 * Inline (each blank typed/dropdown) vs Word bank (drag shared words into gaps).
 * In word-bank mode, extra "distractor" words can be added to the bank.
 */

import { FeedbackFields } from "../shared/Feedback";
import { Field, NumberField, Segmented } from "../shared/controls";
import type { ItemSettingsProps } from "../types";
import { StringListEditor } from "./fields";

export function FillBlanksSettings({ node, setAttr }: ItemSettingsProps) {
  const wordBank = !!node.attrs["wordBank"];
  const points = (node.attrs["points"] as number) ?? 1;
  const distractors = (node.attrs["bankDistractors"] as string[]) ?? [];
  const bankPosition =
    node.attrs["bankPosition"] === "bottom" ? "bottom" : "top";
  return (
    <>
      <Field label="Answering">
        <Segmented
          ariaLabel="Answering mode"
          value={wordBank ? "wordbank" : "inline"}
          options={[
            { value: "inline", label: "Inline" },
            { value: "wordbank", label: "Word bank" },
          ]}
          onChange={(v) => setAttr("wordBank", v === "wordbank")}
        />
      </Field>
      {wordBank && (
        <Field label="Word bank position">
          <Segmented
            ariaLabel="Word bank position"
            value={bankPosition}
            options={[
              { value: "top", label: "Top" },
              { value: "bottom", label: "Bottom" },
            ]}
            onChange={(v) => setAttr("bankPosition", v)}
          />
        </Field>
      )}
      {wordBank && (
        <Field label="Distractors">
          <StringListEditor
            values={distractors}
            onChange={(next) => setAttr("bankDistractors", next)}
            placeholder="Extra word"
            addLabel="+ Add distractor"
          />
        </Field>
      )}
      <Field label="Points">
        <NumberField
          ariaLabel="Points"
          value={points}
          min={0}
          step={1}
          onChange={(n) => setAttr("points", n)}
        />
      </Field>
      <FeedbackFields node={node} setAttr={setAttr} />
    </>
  );
}
