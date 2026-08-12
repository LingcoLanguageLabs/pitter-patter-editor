/**
 * Rating — settings panel (the block menu). Icon style, scale length, optional
 * end labels, completion points, and the "response received" message. No scoring
 * toggle: a rating is always a survey (completion) — there's no right answer.
 */

import { FeedbackFields } from "../shared/Feedback";
import { Field, NumberField, Segmented } from "../shared/controls";
import type { ItemSettingsProps } from "../types";
import type { RatingIconStyle } from "./schema";

export function RatingSettings({ node, setAttr }: ItemSettingsProps) {
  const icon = (node.attrs["icon"] as RatingIconStyle) || "star";
  const scale =
    typeof node.attrs["scale"] === "number" ? (node.attrs["scale"] as number) : 5;
  const points = (node.attrs["points"] as number) ?? 1;
  const low = (node.attrs["lowLabel"] as string) ?? "";
  const high = (node.attrs["highLabel"] as string) ?? "";
  return (
    <>
      <Field label="Icon">
        <Segmented
          ariaLabel="Icon style"
          value={icon}
          options={[
            { value: "star", label: "★" },
            { value: "heart", label: "♥" },
            { value: "emoji", label: "🙂" },
            { value: "number", label: "1–N" },
          ]}
          onChange={(v) => setAttr("icon", v)}
        />
      </Field>
      <Field label="Scale">
        <NumberField
          ariaLabel="Number of icons"
          value={scale}
          min={2}
          step={1}
          onChange={(n) => setAttr("scale", Math.min(10, Math.max(2, n)))}
        />
      </Field>
      <Field label="Low label">
        <input
          type="text"
          className="pb-text-input"
          placeholder="e.g. Poor"
          value={low}
          onChange={(e) => setAttr("lowLabel", e.target.value)}
        />
      </Field>
      <Field label="High label">
        <input
          type="text"
          className="pb-text-input"
          placeholder="e.g. Great"
          value={high}
          onChange={(e) => setAttr("highLabel", e.target.value)}
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
      <FeedbackFields node={node} setAttr={setAttr} scoringMode="completion" />
    </>
  );
}
