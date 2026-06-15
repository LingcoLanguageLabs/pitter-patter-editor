/**
 * "Spacing" section for the block settings popover — the discoverable,
 * type-precise twin of the canvas handles. Groups the spacing controls that
 * apply to the selected block under one header:
 *
 *   • Container gap — the rhythm between a container's stacked children.
 *     Always shown (it's inherent), starting at Auto.
 *   • Top margin — per-block space above. Hidden until "+" (mirrors the canvas
 *     handle's Auto state); the ✕ removes it again.
 *
 * Each row is a `ScrubField`: an icon you drag to scrub (same snap scale + px
 * as the canvas, ⇧ = coarse), a number you can type, and a caret with the
 * presets. The drag axis follows the value — vertical (down to grow) for
 * top/bottom spacing, horizontal (right to grow) for x-axis values — via the
 * `axis` prop, so the cursor + motion always match the spacing it controls.
 * Auto vs explicit is a real distinction — Auto (null) uses the default; an
 * explicit value (a number, INCLUDING 0) overrides it. So you start at Auto and
 * adjust down to 0 (collapse) or up.
 *
 * Presentational only (no PM imports) — edits flow through the `onChange`
 * callbacks BlockSettings wires to `setNodeAttribute`.
 */

"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ArrowLineUp, CaretDown, Plus, X } from "@phosphor-icons/react";
import { type PointerEvent as ReactPointerEvent, useEffect, useState } from "react";

import { BLOCK_MARGIN_MAX, BLOCK_MARGIN_SNAP, snapToScale } from "../spacing";

const MARGIN_PRESETS = [0, 4, 8, 12, 16, 24, 32, 48, 64, 80, 96, 120, 160, 240] as const;

export function SpacingSection({
  margin,
}: {
  /** Block top-margin. Hidden behind "+" until added; `autoPx` is what Auto
   *  resolves to in this block's context (e.g. a container child's default
   *  rhythm), so a scrub starts from the right place. */
  margin: { value: number | null; autoPx: number; onChange: (next: number | null) => void };
}) {
  // Opt-in: shown once it's explicit OR the user clicked "+".
  const [added, setAdded] = useState(margin.value != null);
  const showMargin = margin.value != null || added;

  return (
    <div className="pb-spacing">
      <div className="pb-spacing-head">
        <span className="pb-field-label">Spacing</span>
        {!showMargin && (
          <button
            type="button"
            className="pb-spacing-add"
            aria-label="Add top margin"
            // Reveal at Auto — the user adjusts from there (not a magic default).
            onClick={() => setAdded(true)}
          >
            <Plus size={14} weight="bold" />
          </button>
        )}
      </div>

      {showMargin && (
        <ScrubField
          label="Top margin"
          icon={<ArrowLineUp size={14} />}
          value={margin.value}
          autoPx={margin.autoPx}
          scale={BLOCK_MARGIN_SNAP}
          max={BLOCK_MARGIN_MAX}
          presets={MARGIN_PRESETS}
          onChange={margin.onChange}
          onRemove={() => {
            setAdded(false);
            margin.onChange(null);
          }}
        />
      )}
    </div>
  );
}

function ScrubField({
  label,
  icon,
  value,
  autoPx,
  scale,
  max,
  presets,
  onChange,
  onRemove,
  axis = "vertical",
}: {
  label: string;
  icon: React.ReactNode;
  /** null = Auto. */
  value: number | null;
  /** What Auto resolves to — the scrub start when unset. */
  autoPx: number;
  scale: readonly number[];
  max: number;
  presets: readonly number[];
  onChange: (next: number | null) => void;
  /** When present, a ✕ that removes the row (margin only). */
  onRemove?: () => void;
  /** Which axis the value lives on — sets the scrub direction + cursor so the
   *  drag matches the spacing it controls. Vertical (top/bottom: ns-resize,
   *  drag down to grow) by default; horizontal (left/right: ew-resize, drag
   *  right to grow) for future x-axis padding/margin controls. */
  axis?: "vertical" | "horizontal";
}) {
  // Empty text = Auto; a number = explicit. Resync when value changes (scrub /
  // preset).
  const [text, setText] = useState(value == null ? "" : String(value));
  useEffect(() => setText(value == null ? "" : String(value)), [value]);

  const startScrub = (e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    const start = value ?? autoPx; // scrub from the resolved value, even from Auto
    const horizontal = axis === "horizontal";
    const origin = horizontal ? e.clientX : e.clientY;
    let current: number | null = value;
    document.body.style.cursor = horizontal ? "ew-resize" : "ns-resize";
    document.body.style.userSelect = "none";
    const onMove = (ev: PointerEvent) => {
      // Drag toward growth along the value's own axis: DOWN for vertical
      // spacing, RIGHT for horizontal — both a positive delta, matching the
      // canvas bands. ⇧ = coarse (4× per px).
      const delta = (horizontal ? ev.clientX : ev.clientY) - origin;
      const next = snapToScale(
        scale,
        Math.min(Math.max(start + delta * (ev.shiftKey ? 4 : 1), 0), max),
      );
      if (next === current) return;
      current = next;
      onChange(next); // a scrub always lands on an explicit value
    };
    const onUp = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("pointerup", onUp, true);
    };
    document.addEventListener("pointermove", onMove, true);
    document.addEventListener("pointerup", onUp, true);
    e.preventDefault();
  };

  const commit = () => {
    const trimmed = text.trim();
    if (trimmed === "") {
      onChange(null); // cleared → Auto
      return;
    }
    const n = parseInt(trimmed, 10);
    onChange(Number.isNaN(n) ? value : snapToScale(scale, Math.min(Math.max(n, 0), max)));
  };

  return (
    <div className="pb-field-block">
      <span className="pb-field-label">{label}</span>
      <div className="pb-scrub">
        <button
          type="button"
          className={`pb-scrub-grip${axis === "horizontal" ? " -x" : ""}`}
          aria-label={`Drag to adjust ${label.toLowerCase()}`}
          onPointerDown={startScrub}
        >
          {icon}
        </button>
        <input
          className="pb-scrub-value"
          inputMode="numeric"
          placeholder="Auto"
          value={text}
          onChange={(e) => setText(e.target.value.replace(/[^\d]/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              commit();
              (e.target as HTMLInputElement).blur();
            }
          }}
          onBlur={commit}
          aria-label={label}
        />
        <span className="pb-scrub-unit">{value == null ? "" : "px"}</span>
        <DropdownMenu.Root modal={false}>
          <DropdownMenu.Trigger asChild>
            <button type="button" className="pb-scrub-caret" aria-label="Pick a value">
              <CaretDown size={12} weight="bold" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="pb-scrub-menu" align="end" sideOffset={6}>
              <DropdownMenu.Item
                className="pb-scrub-menu-item"
                data-active={value == null || undefined}
                onSelect={() => onChange(null)}
              >
                Auto
              </DropdownMenu.Item>
              {presets.map((px) => (
                <DropdownMenu.Item
                  key={px}
                  className="pb-scrub-menu-item"
                  data-active={px === value || undefined}
                  onSelect={() => onChange(px)}
                >
                  {px}px
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
        {onRemove && (
          <button
            type="button"
            className="pb-scrub-remove"
            aria-label={`Remove ${label.toLowerCase()}`}
            onClick={onRemove}
          >
            <X size={12} weight="bold" />
          </button>
        )}
      </div>
    </div>
  );
}
