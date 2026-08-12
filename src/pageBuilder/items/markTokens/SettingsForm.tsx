/**
 * Mark the Words — block-menu settings (registered via the ItemDefinition, read
 * by BlockSettings from the registry). Just the point value — the answer key is
 * the marked words in `mt_text`, set inline via the "Mark target" toolbar action,
 * so there's nothing question-level to configure beyond points.
 */

import { FeedbackFields } from "../shared/Feedback";
import { Field, NumberField } from "../shared/controls";
import type { ItemSettingsProps } from "../types";

export function MarkTokensSettings({ node, setAttr }: ItemSettingsProps) {
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
