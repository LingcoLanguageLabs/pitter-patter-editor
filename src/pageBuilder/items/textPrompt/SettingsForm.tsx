/**
 * Text Prompt — settings panel (the block menu). Registered via the
 * `ItemDefinition` so the type stays self-contained. Just the answer-field
 * type; the custom placeholder lives under the shared Attributes section.
 */

import { Field, Segmented } from "../shared/controls";
import type { ItemSettingsProps } from "../types";

export function TextPromptSettings({ node, setAttr }: ItemSettingsProps) {
  const variant = node.attrs["variant"] === "long" ? "long" : "short";
  const fieldWidth =
    node.attrs["fieldWidth"] === "compact" ? "compact" : "fill";
  return (
    <>
      <Field label="Answer">
        <Segmented
          ariaLabel="Answer length"
          value={variant}
          options={[
            { value: "short", label: "Short" },
            { value: "long", label: "Long" },
          ]}
          onChange={(v) => setAttr("variant", v)}
        />
      </Field>
      {/* Width only applies to the single-line short input — the long textarea
          is full-width + vertically drag-resizable. Mirrors the button hiding
          Align when it's set to Fill. */}
      {variant === "short" && (
        <Field label="Width">
          <Segmented
            ariaLabel="Answer width"
            value={fieldWidth}
            options={[
              { value: "compact", label: "Compact" },
              { value: "fill", label: "Fill" },
            ]}
            onChange={(v) => setAttr("fieldWidth", v)}
          />
        </Field>
      )}
    </>
  );
}
