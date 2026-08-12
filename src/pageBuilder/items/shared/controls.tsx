/**
 * Self-contained form controls for item settings panels. React-only (no imports
 * from the page-builder's `blockSettings/` internals), so an item folder stays
 * decoupled and there's no import cycle back through the schema. They reuse the
 * existing `pb-*` classes from page-builder.css, so an item's settings panel
 * looks identical to the built-in block forms.
 */

import type { ReactNode } from "react";

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="pb-field-block">
      <span className="pb-field-label">{label}</span>
      {children}
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: readonly { value: T; label: ReactNode }[];
  onChange: (next: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="pb-segmented" role="group" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className="pb-segmented-option"
          data-active={opt.value === value || undefined}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function NumberField({
  value,
  onChange,
  min = 0,
  step = 1,
  ariaLabel,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  step?: number;
  ariaLabel?: string;
}) {
  return (
    <input
      type="number"
      className="pb-text-input"
      value={Number.isFinite(value) ? value : 0}
      min={min}
      step={step}
      aria-label={ariaLabel}
      onChange={(e) => {
        const n = Number(e.target.value);
        onChange(Number.isFinite(n) ? n : 0);
      }}
    />
  );
}
