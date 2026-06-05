/**
 * Design → Fonts. Mirrors pagy `src/editor/panels/design/fonts.tsx`.
 *
 * Two Radix-backed comboboxes (Base / Heading) with grouped options
 * (Sans / Serif / Mono), a weight combobox that clamps to the
 * heading font's supported weights, and the Pairings preset grid.
 *
 * Hover-preview: hovering a row in either picker temporarily writes
 * the hovered font onto the store so the canvas previews live, and
 * `onMouseLeave` snaps back to the committed theme. Same UX as pagy.
 */

import { useEffect, useRef } from "react";

import { navigateTo, usePageBuilderStore } from "../store";
import {
  Combobox,
  ComboboxGroup,
  ComboboxItem,
} from "../ui/Combobox";
import { FONTS_DEFAULT, type FontDef } from "../theme/fonts";
import {
  SANS_FONTS,
  SERIF_FONTS,
  MONO_FONTS,
  WEIGHT_LABELS,
} from "../theme/fonts-by-type";
import { FONT_PAIRINGS } from "../theme/pairings";
import type { Theme } from "../theme/css";

export function FontsPanel() {
  const theme = usePageBuilderStore((s) => s.theme);
  const setTheme = usePageBuilderStore((s) => s.setTheme);

  // The committed theme — we snapshot on mount and restore on hover-exit
  // so hover-previews never become permanent if the user moves the mouse
  // out without clicking.
  const committedRef = useRef<Theme>(theme);
  useEffect(() => {
    committedRef.current = theme;
  }, [
    theme.fonts?.base,
    theme.fonts?.heading,
    theme.fonts?.headingWeight,
  ]);

  const baseFont = FONTS_DEFAULT.find((f) => f.name === theme.fonts?.base);
  const headingFont = FONTS_DEFAULT.find((f) => f.name === theme.fonts?.heading);

  const setFontCommitted = (slot: "base" | "heading", name: string) => {
    setTheme((prev) => {
      const nextFonts = { ...prev.fonts, [slot]: name };
      if (slot === "heading") {
        const next = FONTS_DEFAULT.find((f) => f.name === name);
        const w = parseInt(String(prev.fonts?.headingWeight ?? 500));
        if (next?.weights && !next.weights.includes(w)) {
          const fallback =
            next.weights.find((x) => x === 700) ??
            next.weights[next.weights.length - 1];
          nextFonts.headingWeight = String(fallback);
        }
      }
      const updated = { ...prev, fonts: nextFonts };
      committedRef.current = updated;
      return updated;
    });
  };

  const previewFont = (slot: "base" | "heading", font: FontDef) =>
    setTheme((prev) => ({
      ...prev,
      fonts: { ...prev.fonts, [slot]: font.name },
    }));

  const snapBack = () => setTheme(committedRef.current);

  const renderPicker = (slot: "base" | "heading") => {
    const current = slot === "base" ? theme.fonts?.base : theme.fonts?.heading;
    const def = FONTS_DEFAULT.find((f) => f.name === current);
    return (
      <Combobox
        value={current ?? ""}
        onValueChange={(v) => v && setFontCommitted(slot, v)}
        onMouseLeave={snapBack}
        triggerStyle={{
          fontFamily: def?.fontFamily || def?.name,
        }}
      >
        <ComboboxGroup label="Sans Serif">
          {SANS_FONTS.map((f) => (
            <ComboboxItem
              key={f.name}
              value={f.name}
              onMouseEnter={() => previewFont(slot, f)}
            >
              <span
                style={{
                  fontFamily: f.fontFamily || f.name,
                  fontWeight: f.regular || 400,
                }}
              >
                {f.name}
              </span>
            </ComboboxItem>
          ))}
        </ComboboxGroup>
        <ComboboxGroup label="Serif">
          {SERIF_FONTS.map((f) => (
            <ComboboxItem
              key={f.name}
              value={f.name}
              onMouseEnter={() => previewFont(slot, f)}
            >
              <span
                style={{
                  fontFamily: f.fontFamily || f.name,
                  fontWeight: f.regular || 400,
                }}
              >
                {f.name}
              </span>
            </ComboboxItem>
          ))}
        </ComboboxGroup>
        <ComboboxGroup label="Mono">
          {MONO_FONTS.map((f) => (
            <ComboboxItem
              key={f.name}
              value={f.name}
              onMouseEnter={() => previewFont(slot, f)}
            >
              <span
                style={{
                  fontFamily: f.fontFamily || f.name,
                  fontWeight: f.regular || 400,
                }}
              >
                {f.name}
              </span>
            </ComboboxItem>
          ))}
        </ComboboxGroup>
      </Combobox>
    );
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
      <h1 className="pb-panel-title">Fonts</h1>

      <div className="pb-field">
        <span className="pb-field-label">Base</span>
        {renderPicker("base")}
        {!baseFont && (
          <p className="pb-field-hint">
            The font you were using is not available anymore, please select a
            new one.
          </p>
        )}
      </div>

      <div className="pb-font-heading-row">
        <div className="pb-field">
          <span className="pb-field-label">Headings</span>
          {renderPicker("heading")}
        </div>
        <div className="pb-field" style={{ flex: "0 0 140px" }}>
          <span className="pb-field-label">Weight</span>
          <Combobox
            value={String(theme.fonts?.headingWeight ?? "")}
            onValueChange={(v) =>
              v &&
              setTheme((prev) => ({
                ...prev,
                fonts: { ...prev.fonts, headingWeight: v },
              }))
            }
            onMouseLeave={snapBack}
          >
            {headingFont?.weights?.map((w) => (
              <ComboboxItem
                key={w}
                value={String(w)}
                onMouseEnter={() =>
                  setTheme((prev) => ({
                    ...prev,
                    fonts: {
                      ...prev.fonts,
                      headingWeight: String(w),
                    },
                  }))
                }
              >
                <span
                  style={{
                    fontFamily: headingFont.fontFamily || headingFont.name,
                    fontWeight: w,
                  }}
                >
                  {WEIGHT_LABELS[w] ?? w}
                </span>
              </ComboboxItem>
            ))}
          </Combobox>
        </div>
      </div>

      <h3 className="pb-panel-section-title">Pairings</h3>
      <div className="pb-options-grid pb-options-grid--wide">
        {FONT_PAIRINGS.map((pair) => {
          const b = FONTS_DEFAULT.find((f) => f.name === pair.base);
          const h = FONTS_DEFAULT.find((f) => f.name === pair.heading);
          if (!b || !h) return null;
          const active =
            theme.fonts?.base === pair.base &&
            theme.fonts?.heading === pair.heading &&
            String(theme.fonts?.headingWeight) === pair.headingWeight;
          return (
            <button
              key={`${pair.base}|${pair.heading}|${pair.headingWeight}`}
              type="button"
              className="pb-options-item"
              data-active={active || undefined}
              onClick={() =>
                setTheme((prev) => {
                  const updated = {
                    ...prev,
                    fonts: {
                      ...prev.fonts,
                      base: pair.base,
                      heading: pair.heading,
                      headingWeight: pair.headingWeight,
                    },
                  };
                  committedRef.current = updated;
                  return updated;
                })
              }
            >
              <div className="pb-font-pair">
                <span
                  className="pb-font-pair-heading"
                  style={{
                    fontFamily: h.fontFamily || h.name,
                    fontSize: 21 + h.offset,
                    fontWeight: Number(pair.headingWeight),
                  }}
                >
                  {pair.heading}
                </span>
                <span
                  className="pb-font-pair-base"
                  style={{
                    fontFamily: b.fontFamily || b.name,
                    fontSize: 14 + b.offset,
                    fontWeight: b.regular || 400,
                  }}
                >
                  {pair.base}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}
