/**
 * Design → Colors. Mirrors pagy `src/editor/panels/design/colors.tsx`.
 *
 * Five color fields (Background / Neutral / Primary / Secondary /
 * Tertiary) laid out in pagy's 6-column grid, followed by a Palettes
 * preset grid. Every change writes straight back to the store theme —
 * `ThemeStyle` re-emits the variables, the canvas reflects it live.
 *
 * No form library in the loop: pitter-patter has no API to PATCH, so
 * the "isDirty / Save" affordances pagy uses don't apply. Editing IS
 * saving.
 */

import { useEffect, useRef, useState } from "react";

import { ColorPicker, isValidColor } from "../ColorPicker";
import { PaletteCluster } from "../PaletteCluster";
import { navigateTo, usePageBuilderStore } from "../store";
import { PALETTES, type ColorPalette } from "../theme/palettes";
import type { Theme } from "../theme/css";
import { isGradient } from "../theme/fill";

type ColorKey = "background" | "neutral" | "primary" | "secondary" | "tertiary";

const FIELDS: {
  key: ColorKey;
  label: string;
  required: boolean;
  span: number;
  gradient?: boolean;
}[] = [
  // Background + accents accept gradients. A gradient paints fills (page/section
  // backgrounds, filled buttons); text/border uses fall back to the base solid.
  // Neutral stays solid — it's the workhorse text/ink colour.
  { key: "background", label: "Background", required: true, span: 3, gradient: true },
  { key: "neutral", label: "Neutral", required: true, span: 3 },
  { key: "primary", label: "Primary", required: true, span: 2, gradient: true },
  { key: "secondary", label: "Secondary", required: false, span: 2, gradient: true },
  { key: "tertiary", label: "Tertiary", required: false, span: 2, gradient: true },
];

export function ColorsPanel() {
  const theme = usePageBuilderStore((s) => s.theme);
  const setTheme = usePageBuilderStore((s) => s.setTheme);

  // The live palette doubles as quick-pick swatches in every field's picker,
  // so reusing an existing theme colour is one click. Solids only — a gradient
  // Background isn't a usable swatch.
  const swatches = FIELDS.map(
    (f) => (theme.colors as Theme["colors"])[f.key],
  ).filter((c): c is string => !!c && !isGradient(c));

  const updateColor = (key: ColorKey, value: string) => {
    setTheme((prev) => ({
      ...prev,
      colors: { ...prev.colors, [key]: value || undefined },
    }));
  };

  const applyPalette = (palette: ColorPalette) => {
    setTheme((prev) => ({
      ...prev,
      colors: {
        background: palette.background,
        neutral: palette.neutral,
        primary: palette.primary,
        secondary: palette.secondary,
        tertiary: palette.tertiary,
      },
    }));
  };

  return (
    <>
      <button
        type="button"
        className="pb-panel-back"
        onClick={() => navigateTo("design")}
        aria-label="Back"
      >
        ←
      </button>
      <h1 className="pb-panel-title">Colors</h1>

      <div className="pb-color-grid">
        {FIELDS.map((f) => (
          <ColorField
            key={f.key}
            label={f.label}
            value={(theme.colors as Theme["colors"])[f.key] ?? ""}
            span={f.span}
            swatches={swatches}
            allowGradient={f.gradient}
            onChange={(v) => updateColor(f.key, v)}
          />
        ))}
      </div>

      <h3 className="pb-panel-section-title">Palettes</h3>
      <div className="pb-options-grid">
        {PALETTES.map((palette, i) => {
          const active =
            palette.background === theme.colors.background &&
            palette.primary === theme.colors.primary &&
            palette.neutral === theme.colors.neutral;
          return (
            <button
              key={i}
              type="button"
              className="pb-options-item"
              data-active={active || undefined}
              onClick={() => applyPalette(palette)}
            >
              <div
                className="pb-palette"
                style={{ background: palette.background }}
              >
                <PaletteCluster
                  colors={[
                    palette.neutral,
                    palette.primary,
                    palette.secondary,
                    palette.tertiary,
                  ]}
                  ring={palette.background}
                />
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}

function ColorField({
  label,
  value,
  span,
  swatches,
  allowGradient,
  onChange,
}: {
  label: string;
  value: string;
  span: number;
  swatches: string[];
  allowGradient?: boolean;
  onChange: (v: string) => void;
}) {
  // Local draft so partial input (e.g. "#" or "#62") stays in the box without
  // being pushed to the theme — only complete, parseable colours commit, which
  // keeps themeToCss from choking on a half-typed hex.
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDraft(value);
  }, [value]);

  // A gradient value isn't editable as text — show a label, edit it in the
  // picker. The hex input only handles solids.
  const gradient = isGradient(value);

  return (
    <div className="pb-color-field" style={{ gridColumn: `span ${span}` }}>
      <span className="pb-color-field-label">{label}</span>
      <div className="pb-color-field-input">
        <ColorPicker
          value={value}
          onChange={onChange}
          ariaLabel={label}
          swatches={swatches}
          allowGradient={allowGradient}
        />
        <input
          type="text"
          className="pb-color-field-hex"
          value={gradient ? "Gradient" : draft}
          readOnly={gradient}
          spellCheck={false}
          autoComplete="off"
          aria-label={`${label} hex`}
          onFocus={() => (focused.current = true)}
          onBlur={() => {
            focused.current = false;
            setDraft(value);
          }}
          onChange={(e) => {
            const v = e.target.value;
            setDraft(v);
            const trimmed = v.trim();
            const norm = !trimmed || trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
            if (isValidColor(norm)) onChange(norm);
          }}
        />
      </div>
    </div>
  );
}
