/**
 * Labeled image — settings panel. The image (URL or upload), alt text, the
 * panel eyebrow, and the list of markers' content (title + description). Marker
 * POSITIONS are set by dragging on the image (see `MarkerImage`); this panel
 * owns their text. Self-contained (no blockSettings imports): the upload reads
 * the file to a data URL via `FileReader`.
 */

import type { ChangeEvent } from "react";

import { Field } from "../shared/controls";
import type { ItemSettingsProps } from "../types";
import type { LabeledMarker } from "./markers";

export function LabeledImageSettings({ node, setAttr }: ItemSettingsProps) {
  const src = (node.attrs["src"] as string) ?? "";
  const alt = (node.attrs["alt"] as string) ?? "";
  const eyebrow = (node.attrs["eyebrow"] as string) ?? "Tap a marker";
  const markers = (node.attrs["markers"] as LabeledMarker[]) ?? [];

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAttr("src", String(reader.result || ""));
    reader.readAsDataURL(file);
    e.target.value = ""; // allow re-picking the same file
  };

  const update = (id: string, patch: Partial<LabeledMarker>) =>
    setAttr(
      "markers",
      markers.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    );
  const remove = (id: string) =>
    setAttr("markers", markers.filter((m) => m.id !== id));

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
      <Field label="Panel label">
        <input
          type="text"
          className="pb-text-input"
          placeholder="Tap a marker"
          value={eyebrow}
          onChange={(e) => setAttr("eyebrow", e.target.value)}
        />
      </Field>

      <Field label="Markers">
        {markers.length === 0 ? (
          <p className="pb-field-hint">Click the image on the canvas to add a marker.</p>
        ) : (
          <div className="pb-labeled-markers">
            {markers.map((m, i) => (
              <div key={m.id} className="pb-labeled-marker-row">
                <span className="pb-labeled-marker-num">{i + 1}</span>
                <div className="pb-labeled-marker-fields">
                  <input
                    type="text"
                    className="pb-text-input"
                    placeholder="Title"
                    value={m.label}
                    onChange={(e) => update(m.id, { label: e.target.value })}
                  />
                  <textarea
                    className="pb-text-input pb-labeled-marker-body"
                    placeholder="Description"
                    rows={2}
                    value={m.body}
                    onChange={(e) => update(m.id, { body: e.target.value })}
                  />
                </div>
                <button
                  type="button"
                  className="pb-labeled-marker-del"
                  aria-label={`Delete marker ${i + 1}`}
                  onClick={() => remove(m.id)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </Field>
    </>
  );
}
