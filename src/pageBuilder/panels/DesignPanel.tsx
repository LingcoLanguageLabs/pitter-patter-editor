/**
 * Design → landing tiles. Mirrors pagy `src/editor/panels/design.tsx`:
 * four tiles (Colors / Fonts / Buttons / Forms), with a Themes preset grid
 * below (see <ThemesGrid/>).
 *
 * Each tile renders a live preview off `store.theme`, so the moment a
 * user lands on a palette or pairing the cards reflect it without a
 * round-trip through the canvas.
 */

import { CaretRight } from "@phosphor-icons/react";

import { PaletteCluster } from "../PaletteCluster";
import { navigateTo, usePageBuilderStore } from "../store";
import { FONTS_DEFAULT } from "../theme/fonts";
import { THEME_PRESETS } from "../theme/presets";
import { ThemesGrid } from "./ThemesGrid";

export function DesignPanel() {
  const theme = usePageBuilderStore((s) => s.theme);

  const bodyFont = FONTS_DEFAULT.find((f) => f.name === theme.fonts?.base);
  const headingFont = FONTS_DEFAULT.find((f) => f.name === theme.fonts?.heading);

  // The Buttons tile shows the actual themed button — same `.site` +
  // token-class trick the Buttons panel uses for its previews.
  const btnTokens = [
    theme.buttons?.radius && `button-radius-${theme.buttons.radius}`,
    theme.buttons?.style && `button-style-${theme.buttons.style}`,
  ]
    .filter(Boolean)
    .join(" ");
  const inputTokens = [
    theme.inputs?.shape && `input-shape-${theme.inputs.shape}`,
    theme.inputs?.style && `input-style-${theme.inputs.style}`,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <button
        type="button"
        className="pb-panel-back"
        onClick={() => navigateTo("menu")}
        aria-label="Back"
      >
        ←
      </button>
      <h1 className="pb-panel-title">Design</h1>

      <div className="pb-design-tiles">
        <button
          type="button"
          className="pb-card-link"
          onClick={() => navigateTo("colors")}
        >
          <div className="pb-card-link-header">
            <span>Colors</span>
            <CaretRight size={14} weight="regular" />
          </div>
          <div
            className="pb-card-link-preview"
            style={{ background: theme.colors.background }}
          >
            <div className="pb-palette -large">
              <PaletteCluster
                colors={[
                  theme.colors.neutral,
                  theme.colors.primary,
                  theme.colors.secondary,
                  theme.colors.tertiary,
                ]}
                ring={theme.colors.background}
                size={44}
              />
            </div>
          </div>
        </button>

        <button
          type="button"
          className="pb-card-link"
          onClick={() => navigateTo("fonts")}
        >
          <div className="pb-card-link-header">
            <span>Fonts</span>
            <CaretRight size={14} weight="regular" />
          </div>
          <div className="pb-card-link-preview pb-card-link-preview--fonts">
            <div className="pb-font-pair">
              <span
                className="pb-font-pair-heading"
                style={{
                  fontFamily: headingFont?.fontFamily || headingFont?.name,
                  fontSize: 21 + (headingFont?.offset ?? 0),
                  fontWeight: Number(theme.fonts?.headingWeight ?? 500),
                }}
              >
                {headingFont?.name ?? "—"}
              </span>
              <span
                className="pb-font-pair-base"
                style={{
                  fontFamily: bodyFont?.fontFamily || bodyFont?.name,
                  fontSize: 14 + (bodyFont?.offset ?? 0),
                  fontWeight: bodyFont?.regular || 400,
                }}
              >
                {bodyFont?.name ?? "—"}
              </span>
            </div>
          </div>
        </button>

        <button
          type="button"
          className="pb-card-link"
          onClick={() => navigateTo("buttons")}
        >
          <div className="pb-card-link-header">
            <span>Buttons</span>
            <CaretRight size={14} weight="regular" />
          </div>
          <div
            className="pb-card-link-preview"
            style={{ background: theme.colors.background }}
          >
            <span className={`site pb-inline-flex ${btnTokens}`}>
              <span className="pp-button pp-button--primary pp-color-primary pp-size-s">
                Button
              </span>
            </span>
          </div>
        </button>

        <button
          type="button"
          className="pb-card-link"
          onClick={() => navigateTo("inputs")}
        >
          <div className="pb-card-link-header">
            <span>Inputs</span>
            <CaretRight size={14} weight="regular" />
          </div>
          <div
            className="pb-card-link-preview"
            style={{ background: theme.colors.background }}
          >
            <span className={`site pb-w-full ${inputTokens}`}>
              <span className="pp-field">
                <span className="pp-field-text">Field</span>
              </span>
            </span>
          </div>
        </button>
      </div>

      <ThemesGrid presets={THEME_PRESETS} />
    </>
  );
}
