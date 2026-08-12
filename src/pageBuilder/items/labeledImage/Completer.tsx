/**
 * Labeled image — completer (student-facing). Exploratory, NOT graded: the
 * author's markers are visible dots on the image; selecting one (the dot OR its
 * chip in the label row) reveals that marker's title + description in the side
 * panel. Selection is pure local state — nothing persists to the grading store,
 * there's no Check button and no answer key (that's what Hotspot is for).
 *
 * Layout mirrors the field-guide reference: image on the left, an info panel on
 * the right with an eyebrow, the selected title + body, and a wrap of chips.
 */

import { useState } from "react";

import { useRenderBlocks } from "../shared/blockRenderer";
import type { CompleterProps } from "../types";
import { markerStyle } from "./markers";
import type { LabeledImageDef } from "./serialize";

export function LabeledImageCompleter({ def }: CompleterProps<LabeledImageDef>) {
  const { src, alt, eyebrow, markers, prompt } = def;
  const renderBlocks = useRenderBlocks();

  // Default to the first marker selected (like the reference's opening state).
  const [selectedId, setSelectedId] = useState<string | null>(
    () => markers[0]?.id ?? null,
  );
  const selected = markers.find((m) => m.id === selectedId) ?? null;

  // The stem always carries at least one (possibly empty) paragraph; only render
  // it when it has real content, so an unused intro leaves no blank gap.
  const hasPrompt = prompt.some((b) => !!b.text || !!b.content?.length);

  return (
    <div className="pp-labeled-completer">
      {hasPrompt && (
        <div className="pp-labeled-completer-prompt">{renderBlocks(prompt)}</div>
      )}
      <div className="pp-labeled-layout">
        <div className="pp-labeled-image">
          {src ? (
            <img src={src} alt={alt} draggable={false} />
          ) : (
            <div className="pp-labeled-empty">No image</div>
          )}
          {markers.map((m) => (
            <button
              key={m.id}
              type="button"
              className="pp-labeled-marker"
              data-selected={selected?.id === m.id || undefined}
              style={markerStyle(m)}
              aria-pressed={selected?.id === m.id}
              aria-label={m.label || "Marker"}
              onClick={() => setSelectedId(m.id)}
            />
          ))}
        </div>

        <div className="pp-labeled-panel">
          {eyebrow && <p className="pp-labeled-eyebrow">{eyebrow}</p>}
          {selected ? (
            <>
              <h3 className="pp-labeled-title">{selected.label || "Untitled"}</h3>
              {selected.body && <p className="pp-labeled-body">{selected.body}</p>}
            </>
          ) : (
            <p className="pp-labeled-body pp-labeled-body--muted">
              Select a marker to learn more.
            </p>
          )}

          {markers.length > 0 && (
            <div className="pp-labeled-chips">
              {markers.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="pp-labeled-chip"
                  data-selected={selected?.id === m.id || undefined}
                  onClick={() => setSelectedId(m.id)}
                >
                  {m.label || "Untitled"}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
