/**
 * Multiple Choice — settings panel (the block menu). Lives in the item folder
 * and is registered via the `ItemDefinition` (Classroom's `propertiesComponent`
 * model), so the type stays self-contained — `BlockSettings` reads it from the
 * registry rather than this being wired into the central forms file.
 */

import { FeedbackFields } from "../shared/Feedback";
import { Field, NumberField, Segmented } from "../shared/controls";
import type { ItemSettingsProps } from "../types";

export function MultipleChoiceSettings({ node, setAttr }: ItemSettingsProps) {
  const multiple = !!node.attrs["multiple"];
  const points = (node.attrs["points"] as number) ?? 1;
  const completion = node.attrs["scoringMode"] === "completion";
  const grid = node.attrs["layout"] === "grid";
  return (
    <>
      <Field label="Layout">
        <Segmented
          ariaLabel="Option layout"
          value={grid ? "grid" : "list"}
          options={[
            { value: "list", label: "List" },
            { value: "grid", label: "Image grid" },
          ]}
          onChange={(v) => setAttr("layout", v)}
        />
      </Field>
      {grid && (
        <p className="pb-field-hint">
          Each option becomes a card; add an image to a card from its image
          button on the canvas.
        </p>
      )}
      <Field label="Answers">
        <Segmented
          ariaLabel="Answer mode"
          value={multiple ? "multiple" : "single"}
          options={[
            { value: "single", label: "Single" },
            { value: "multiple", label: "Multiple" },
          ]}
          onChange={(v) => setAttr("multiple", v === "multiple")}
        />
      </Field>
      <Field label="Scoring">
        <Segmented
          ariaLabel="Scoring mode"
          value={completion ? "completion" : "correctness"}
          options={[
            { value: "correctness", label: "Correctness" },
            { value: "completion", label: "Completion" },
          ]}
          onChange={(v) => setAttr("scoringMode", v)}
        />
      </Field>
      <p className="pb-field-hint">
        {completion
          ? "No right answer — any selection earns full credit (an opinion poll)."
          : "Graded against the options you mark correct."}
      </p>
      <Field label="Points">
        <NumberField
          ariaLabel="Points"
          value={points}
          min={0}
          step={1}
          onChange={(n) => setAttr("points", n)}
        />
      </Field>
      <FeedbackFields
        node={node}
        setAttr={setAttr}
        scoringMode={completion ? "completion" : "correctness"}
      />
    </>
  );
}
