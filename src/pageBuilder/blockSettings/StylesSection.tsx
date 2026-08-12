/**
 * "Styles" section for the block settings popover — visual treatments that apply
 * to blocks with a background, fill, or media (image, video, card, section,
 * container, button). Holds Opacity plus the optional Min/Max width clamps (px),
 * which used to live under their own "Width limits" heading — folded in here so
 * every visual treatment sits under one "Styles" group.
 *
 * All three are opt-in via the section's single "+" menu (`SectionHeader` +
 * `useOptInVisibility`, forms.tsx) rather than a "+" per row — picking one
 * reveals its control; the "✕" removes it again. Opacity's `null` = unset
 * (fully opaque, no style emitted) and a 0–1 number = explicit — the same
 * Auto-vs-explicit split the Spacing section's margin uses. The width clamps
 * share the same shared row (`PropertyRow`); 0 = no clamp. Each prop is
 * optional — a block renders only the treatments its schema carries.
 * Presentational only; edits flow through `onChange` → `setNodeAttribute`.
 */

"use client";

import { X } from "@phosphor-icons/react";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { PropertyRow, SectionHeader, useOptInVisibility } from "./forms";

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
/** Trim float noise (slider/typed) to 2 dp without trailing zeros. */
const round2 = (n: number) => Math.round(n * 100) / 100;
const format = (n: number) => String(round2(n));

export function StylesSection({
  opacity,
  widthLimits,
}: {
  /** null = unset (fully opaque, hidden behind "+"); a 0–1 number is explicit.
   *  Omitted for blocks whose schema has no `opacity` attr. */
  opacity?: {
    value: number | null;
    onChange: (next: number | null) => void;
  };
  /** Optional px clamps on the rendered width. Omitted for blocks without the
   *  shared minW/maxW attrs. 0 = no clamp. */
  widthLimits?: {
    minW: number;
    maxW: number;
    onChange: (name: "minW" | "maxW", value: number) => void;
  };
}) {
  const { isVisible, add, remove } = useOptInVisibility(
    [
      opacity && opacity.value != null ? "opacity" : null,
      widthLimits && widthLimits.minW > 0 ? "minW" : null,
      widthLimits && widthLimits.maxW > 0 ? "maxW" : null,
    ].filter((key): key is string => key !== null),
  );

  const addable = [
    opacity && !isVisible("opacity")
      ? { key: "opacity", label: "Opacity" }
      : null,
    widthLimits && !isVisible("minW")
      ? { key: "minW", label: "Min width" }
      : null,
    widthLimits && !isVisible("maxW")
      ? { key: "maxW", label: "Max width" }
      : null,
  ].filter((opt): opt is { key: string; label: string } => opt !== null);

  return (
    <div className="pb-styles">
      <SectionHeader label="Styles" addable={addable} onAdd={add} />
      {opacity && isVisible("opacity") && (
        <OpacityRow
          opacity={opacity}
          onRemove={() => remove("opacity")}
        />
      )}
      {widthLimits && isVisible("minW") && (
        <WidthRow
          label="Min width"
          value={widthLimits.minW}
          onChange={(v) => widthLimits.onChange("minW", v)}
          onRemove={() => remove("minW")}
        />
      )}
      {widthLimits && isVisible("maxW") && (
        <WidthRow
          label="Max width"
          value={widthLimits.maxW}
          onChange={(v) => widthLimits.onChange("maxW", v)}
          onRemove={() => remove("maxW")}
        />
      )}
    </div>
  );
}

/** A single width clamp — a static "px" unit suffix after the input (the
 *  label drops the "(px)" parenthetical). Visibility is owned by the section
 *  (via `useOptInVisibility`); this row always renders expanded. */
function WidthRow({
  label,
  value,
  onChange,
  onRemove,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  onRemove: () => void;
}) {
  return (
    <PropertyRow
      label={label}
      onRemove={() => {
        onRemove();
        onChange(0);
      }}
    >
      <input
        type="number"
        className="pb-text-input"
        min={0}
        placeholder="None"
        aria-label={label}
        value={value || ""}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
      <span className="pb-input-unit">px</span>
    </PropertyRow>
  );
}

/** Opacity's row — bespoke (wraps a slider track) rather than `PropertyRow`,
 *  but visibility is owned by the section the same way. */
function OpacityRow({
  opacity,
  onRemove,
}: {
  opacity: { value: number | null; onChange: (next: number | null) => void };
  onRemove: () => void;
}) {
  return (
    <div className="pb-opacity-row">
      <span className="pb-field-label">Opacity</span>
      <OpacityControl
        value={opacity.value ?? 1}
        onChange={(n) => opacity.onChange(n)}
        onRemove={() => {
          onRemove();
          opacity.onChange(null);
        }}
      />
    </div>
  );
}

function OpacityControl({
  value,
  onChange,
  onRemove,
}: {
  value: number;
  onChange: (n: number) => void;
  onRemove: () => void;
}) {
  // Local text so typing "0." doesn't fight the committed value; resync on
  // external change (slider drag, preset).
  const [text, setText] = useState(format(value));
  useEffect(() => setText(format(value)), [value]);

  const commit = () => {
    const n = parseFloat(text);
    if (Number.isNaN(n)) {
      setText(format(value));
      return;
    }
    onChange(clamp01(round2(n)));
  };

  return (
    <div className="pb-opacity">
      <input
        className="pb-scrub-value pb-opacity-value"
        inputMode="decimal"
        value={text}
        aria-label="Opacity"
        onChange={(e) => setText(e.target.value.replace(/[^\d.]/g, ""))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit();
            (e.target as HTMLInputElement).blur();
          }
        }}
        onBlur={commit}
      />
      <OpacitySlider value={value} onChange={onChange} />
      <button
        type="button"
        className="pb-scrub-remove"
        aria-label="Remove opacity"
        onClick={onRemove}
      >
        <X size={12} weight="bold" />
      </button>
    </div>
  );
}

/**
 * A 0–1 slider driven by a document-level pointer drag — NOT a native
 * `<input type="range">`. Each move commits to the doc (setNodeAttribute), which
 * re-renders this whole popover and lets @floating-ui reposition it; a native
 * range loses its drag the instant that happens, so you could click but not
 * drag. The drag loop lives on `document` (capture phase), exactly like the
 * Spacing scrubber, so panel re-renders never interrupt it. The track rect is
 * re-read each move, so a reposition mid-drag can't skew the mapping.
 */
function OpacitySlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  const startDrag = (e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    const track = trackRef.current;
    if (!track) return;
    const at = (clientX: number) => {
      const r = track.getBoundingClientRect();
      if (r.width === 0) return value;
      return clamp01(round2((clientX - r.left) / r.width));
    };
    onChange(at(e.clientX)); // jump to the press position
    const onMove = (ev: PointerEvent) => onChange(at(ev.clientX));
    const onUp = () => {
      document.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("pointerup", onUp, true);
      document.body.style.userSelect = "";
    };
    document.body.style.userSelect = "none";
    document.addEventListener("pointermove", onMove, true);
    document.addEventListener("pointerup", onUp, true);
    e.preventDefault();
  };

  const pct = `${Math.round(value * 100)}%`;
  return (
    <div
      ref={trackRef}
      className="pb-opacity-slider"
      role="slider"
      tabIndex={0}
      aria-label="Opacity"
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuenow={value}
      onPointerDown={startDrag}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowDown")
          onChange(clamp01(round2(value - 0.05)));
        if (e.key === "ArrowRight" || e.key === "ArrowUp")
          onChange(clamp01(round2(value + 0.05)));
      }}
    >
      <span className="pb-opacity-fill" style={{ width: pct }} />
      <span className="pb-opacity-thumb" style={{ left: pct }} />
    </div>
  );
}
