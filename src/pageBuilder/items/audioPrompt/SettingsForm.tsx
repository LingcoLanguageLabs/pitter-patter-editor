/**
 * Audio Prompt — settings panel (the block menu / "options"). Registered via the
 * `ItemDefinition` so the type stays self-contained. The three recorder options:
 * how many attempts, whether playback is allowed, and whether an upload is.
 */

import { Field, NumberField, Segmented } from "../shared/controls";
import type { ItemSettingsProps } from "../types";

export function AudioPromptSettings({ node, setAttr }: ItemSettingsProps) {
  const attempts = (node.attrs["attempts"] as number) ?? 1;
  const allowPlayback = node.attrs["allowPlayback"] !== false;
  const allowUpload = !!node.attrs["allowUpload"];
  return (
    <>
      <Field label="Attempts">
        <NumberField
          ariaLabel="Attempts"
          value={attempts}
          min={1}
          step={1}
          onChange={(n) => setAttr("attempts", Math.max(1, Math.round(n)))}
        />
      </Field>
      <Field label="Allow playback">
        <Segmented
          ariaLabel="Allow playback"
          value={allowPlayback ? "yes" : "no"}
          options={[
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
          ]}
          onChange={(v) => setAttr("allowPlayback", v === "yes")}
        />
      </Field>
      <Field label="Allow upload">
        <Segmented
          ariaLabel="Allow upload"
          value={allowUpload ? "yes" : "no"}
          options={[
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
          ]}
          onChange={(v) => setAttr("allowUpload", v === "yes")}
        />
      </Field>
    </>
  );
}
