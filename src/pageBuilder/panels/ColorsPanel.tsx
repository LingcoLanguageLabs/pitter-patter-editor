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

import { PaletteCluster } from "../PaletteCluster";
import { navigateTo, usePageBuilderStore } from "../store";
import { PALETTES, type ColorPalette } from "../theme/palettes";
import type { Theme } from "../theme/css";

type ColorKey = "background" | "neutral" | "primary" | "secondary" | "tertiary";

const FIELDS: { key: ColorKey; label: string; required: boolean; span: number }[] = [
  { key: "background", label: "Background", required: true, span: 3 },
  { key: "neutral", label: "Neutral", required: true, span: 3 },
  { key: "primary", label: "Primary", required: true, span: 2 },
  { key: "secondary", label: "Secondary", required: false, span: 2 },
  { key: "tertiary", label: "Tertiary", required: false, span: 2 },
];

export function ColorsPanel() {
  const theme = usePageBuilderStore((s) => s.theme);
  const setTheme = usePageBuilderStore((s) => s.setTheme);

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
  onChange,
}: {
  label: string;
  value: string;
  span: number;
  onChange: (v: string) => void;
}) {
  return (
    <label className="pb-color-field" style={{ gridColumn: `span ${span}` }}>
      <span className="pb-color-field-label">{label}</span>
      <div className="pb-color-field-input">
        <input
          type="color"
          className="pb-color-field-swatch"
          value={value || "#ffffff"}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
        />
        <input
          type="text"
          className="pb-color-field-hex"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </label>
  );
}
