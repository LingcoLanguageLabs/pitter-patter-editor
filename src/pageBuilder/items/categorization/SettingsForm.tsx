/**
 * Categorization — settings panel (the block menu). Registered via the
 * `ItemDefinition` so the type stays self-contained. Lets the author choose the
 * completer presentation (drag-and-drop grid vs. radio-button matrix) and the
 * point value.
 */

import { FeedbackFields } from "../shared/Feedback";
import { Field, NumberField, Segmented } from "../shared/controls";
import type { ItemSettingsProps } from "../types";
import type { CatDisplay } from "./schema";

export function CategorizationSettings({ node, setAttr }: ItemSettingsProps) {
  const display = (node.attrs["display"] as CatDisplay) ?? "grid";
  const points = (node.attrs["points"] as number) ?? 1;
  return (
    <>
      <Field label="Display">
        <Segmented
          ariaLabel="Display mode"
          value={display}
          options={[
            { value: "grid", label: "Grid" },
            { value: "matrix", label: "Matrix" },
          ]}
          onChange={(v) => setAttr("display", v)}
        />
      </Field>
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
