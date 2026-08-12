/**
 * Hotspot — settings panel. The image source (URL or upload), alt text, points,
 * and the correct/incorrect verdict messages. Regions are drawn on the image
 * itself (see `DrawableImage`), not here. Self-contained (no blockSettings
 * imports): the upload reads the file to a data URL via `FileReader`.
 */

import type { ChangeEvent } from "react";

import { FeedbackFields } from "../shared/Feedback";
import { Field, NumberField, Segmented } from "../shared/controls";
import type { ItemSettingsProps } from "../types";

export function HotspotSettings({ node, setAttr }: ItemSettingsProps) {
  const src = (node.attrs["src"] as string) ?? "";
  const alt = (node.attrs["alt"] as string) ?? "";
  const points = (node.attrs["points"] as number) ?? 1;
  const mode = node.attrs["mode"] === "find" ? "find" : "select";

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAttr("src", String(reader.result || ""));
    reader.readAsDataURL(file);
    e.target.value = ""; // allow re-picking the same file
  };

  return (
    <>
      <Field label="Image">
        <div className="pb-hotspot-src">
          <input
            type="text"
            className="pb-text-input"
            placeholder="Image URL"
            value={src.startsWith("data:") ? "" : src}
            onChange={(e) => setAttr("src", e.target.value)}
          />
          <label className="pb-hotspot-upload">
            {src ? "Replace" : "Upload"}
            <input type="file" accept="image/*" hidden onChange={onFile} />
          </label>
        </div>
      </Field>
      <Field label="Alt text">
        <input
          type="text"
          className="pb-text-input"
          placeholder="Describe the image"
          value={alt}
          onChange={(e) => setAttr("alt", e.target.value)}
        />
      </Field>
      <Field label="Answering">
        <Segmented
          ariaLabel="Answering mode"
          value={mode}
          options={[
            { value: "select", label: "Tap regions" },
            { value: "find", label: "Find on image" },
          ]}
          onChange={(v) => setAttr("mode", v)}
        />
      </Field>
      <p className="pb-field-hint">
        {mode === "find"
          ? "Regions are hidden — the student clicks the image to find each target. Draw the areas to find."
          : "Regions are shown — the student taps the correct ones. Draw boxes/points and mark each Correct or Distractor."}
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
      <FeedbackFields node={node} setAttr={setAttr} scoringMode="correctness" />
    </>
  );
}
