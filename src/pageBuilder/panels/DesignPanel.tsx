/**
 * Design → landing tiles. Mirrors pagy `src/editor/panels/design.tsx`.
 *
 * Pagy's version has four tiles (Colors / Fonts / Buttons / Forms) and
 * a Themes preset grid below. We're only shipping Colors and Fonts in
 * the first pass per scope — Buttons and Forms come later once the
 * button/input style tokens have somewhere to apply (right now no
 * primitives in the demo doc consume them).
 *
 * Each tile renders a live preview off `store.theme`, so the moment a
 * user lands on a palette or pairing the cards reflect it without a
 * round-trip through the canvas.
 */

import { CaretRight } from "@phosphor-icons/react";

import { navigateTo, usePageBuilderStore } from "../store";
import { FONTS_DEFAULT } from "../theme/fonts";

export function DesignPanel() {
  const theme = usePageBuilderStore((s) => s.theme);

  const bodyFont = FONTS_DEFAULT.find((f) => f.name === theme.fonts?.base);
  const headingFont = FONTS_DEFAULT.find((f) => f.name === theme.fonts?.heading);

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
              <span
                className="pb-palette-swatch"
                style={{ background: theme.colors.neutral }}
              />
              <span
                className="pb-palette-swatch"
                style={{ background: theme.colors.primary }}
              />
              {theme.colors.secondary && (
                <span
                  className="pb-palette-swatch"
                  style={{ background: theme.colors.secondary }}
                />
              )}
              {theme.colors.tertiary && (
                <span
                  className="pb-palette-swatch"
                  style={{ background: theme.colors.tertiary }}
                />
              )}
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
      </div>
    </>
  );
}
