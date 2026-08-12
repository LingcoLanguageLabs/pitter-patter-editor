/**
 * "Attributes" section for the block settings popover — the shared home for a
 * block's semantic HTML attributes, the way the Spacing/Styles sections are the
 * shared home for layout/visual ones. It's driven by which attrs the selected
 * block actually carries, so the same section serves every block type:
 *
 *   • Language    — the block's `lang` (BCP-47). Text-bearing blocks + sections.
 *   • Placeholder — a custom input placeholder (text prompt).
 *   • Alt text    — the image's `alt`.
 *
 * Language + Placeholder are opt-in via the section's "+" menu (see
 * `SectionHeader`/`useOptInVisibility` in forms.tsx): picking one from the menu
 * reveals its row (control + ✕); ✕ clears it back to none and drops it from the
 * menu's "already shown" set. Alt text isn't opt-in — an image without alt text
 * is still worth flagging, so it's always visible. Media blocks carry no
 * `lang`, so Language is absent for them.
 *
 * Presentational only (no PM imports) — each control's edits flow through its
 * `onChange`, which the host wires to `setNodeAttribute`. Whichever props are
 * passed decide which rows can appear; the section is hidden entirely when the
 * block has none of the attrs (the host gates on that). Pass a `key` (the
 * block pos) so the opt-in visibility resets when the selection changes.
 */

"use client";

import { LANGUAGE_OPTIONS } from "../schema";

import { Field, PropertyRow, SectionHeader, useOptInVisibility } from "./forms";

export function AttributesSection({
  language,
  placeholder,
  alt,
}: {
  /** The block's `lang` ("" = none), when it carries the attr. */
  language?: {
    value: string;
    onChange: (next: string) => void;
  };
  /** A custom input placeholder ("" = none), when the block carries the attr. */
  placeholder?: {
    value: string;
    onChange: (next: string) => void;
  };
  /** The block's `alt` text, when it carries the attr (images). */
  alt?: {
    value: string;
    onChange: (next: string) => void;
  };
}) {
  const { isVisible, add, remove } = useOptInVisibility(
    [
      language && language.value !== "" ? "language" : null,
      placeholder && placeholder.value !== "" ? "placeholder" : null,
    ].filter((key): key is string => key !== null),
  );

  const addable = [
    language && !isVisible("language")
      ? { key: "language", label: "Language" }
      : null,
    placeholder && !isVisible("placeholder")
      ? { key: "placeholder", label: "Placeholder" }
      : null,
  ].filter((opt): opt is { key: string; label: string } => opt !== null);

  return (
    <div className="pb-attributes">
      <SectionHeader label="Attributes" addable={addable} onAdd={add} />

      {language && isVisible("language") && (
        <PropertyRow
          label="Language"
          onRemove={() => {
            remove("language");
            language.onChange("");
          }}
        >
          <select
            className="pb-select"
            aria-label="Language"
            value={language.value}
            onChange={(e) => language.onChange(e.target.value)}
          >
            <option value="">Choose…</option>
            {LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.code} value={opt.code}>
                {opt.label}
              </option>
            ))}
          </select>
        </PropertyRow>
      )}

      {placeholder && isVisible("placeholder") && (
        <PropertyRow
          label="Placeholder"
          onRemove={() => {
            remove("placeholder");
            placeholder.onChange("");
          }}
        >
          <input
            type="text"
            className="pb-text-input"
            aria-label="Placeholder"
            value={placeholder.value}
            placeholder="Type your answer…"
            onChange={(e) => placeholder.onChange(e.target.value)}
          />
        </PropertyRow>
      )}

      {alt && (
        <Field label="Alt text">
          <input
            type="text"
            className="pb-text-input"
            value={alt.value}
            placeholder="Describe the image"
            onChange={(e) => alt.onChange(e.target.value)}
          />
        </Field>
      )}
    </div>
  );
}
