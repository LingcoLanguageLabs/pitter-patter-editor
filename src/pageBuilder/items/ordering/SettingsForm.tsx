/**
 * Ordering — settings panel (the block menu). Registered via the
 * `ItemDefinition` so the type stays self-contained. Ordering has no display
 * variants (it's a single sortable list), so the only option is the point value.
 */

import { FeedbackFields } from "../shared/Feedback";
import { Field, NumberField } from "../shared/controls";
import type { ItemSettingsProps } from "../types";

export function OrderingSettings({ node, setAttr }: ItemSettingsProps) {
  const points = (node.attrs["points"] as number) ?? 1;
  return (
    <>
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
