/**
 * Design → Themes preset grid. Mirrors pagy's `THEME_PRESETS` tiles: a 2-up
 * grid where each tile previews a full theme (heading "Aa", a button, the
 * color cluster) and clicking it applies that theme wholesale.
 *
 * Each tile is its own `.site` so it can paint the *preset's* colors (not the
 * live theme): the five palette colors are injected as inline custom
 * properties — genuinely per-tile dynamic values, so they can't be utility
 * classes — and `themeClassName(preset)` adds the button/input token classes
 * so the button preview shows that theme's shape + style.
 */

import type { CSSProperties } from "react";

import { PaletteCluster } from "../PaletteCluster";
import { usePageBuilderStore } from "../store";
import { themeClassName, type Theme } from "../theme/css";
import { FONTS_DEFAULT, FONTS_PRO } from "../theme/fonts";

function findFont(name: string | undefined) {
  if (!name) return undefined;
  return (
    FONTS_DEFAULT.find((f) => f.name === name) ||
    FONTS_PRO.find((f) => f.name === name)
  );
}

/** Cheap perceived-luminance test → pick a readable foreground for the
 *  preview's filled button (white on a dark hue, the neutral otherwise). */
function isDark(hex: string): boolean {
  const h = hex.replace("#", "");
  if (h.length !== 6) return true;
  const n = Number.parseInt(h, 16);
  if (Number.isNaN(n)) return true;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b < 140;
}

function tileVars(preset: Theme): CSSProperties {
  const { background, neutral, primary, secondary, tertiary } = preset.colors;
  const n = neutral || "#1a1b20";
  return {
    background,
    "--color-background": background,
    "--color-neutral": n,
    "--color-primary": primary,
    "--color-secondary": secondary,
    "--color-tertiary": tertiary,
    "--color-primary-foreground": isDark(primary) ? "#ffffff" : n,
  } as CSSProperties;
}

export function ThemesGrid({ presets }: { presets: Theme[] }) {
  const setTheme = usePageBuilderStore((s) => s.setTheme);

  return (
    <>
      <h2 className="pb-themes-heading">Themes</h2>
      <div className="pb-themes">
        {presets.map((preset, i) => {
          const heading = findFont(preset.fonts?.heading);
          const neutral = preset.colors.neutral || "#1a1b20";
          return (
            <button
              key={i}
              type="button"
              className={`pb-theme-tile site ${themeClassName(preset)}`}
              style={tileVars(preset)}
              aria-label={`Theme ${i + 1}`}
              onClick={() => setTheme(preset)}
            >
              <span
                className="pb-theme-aa"
                style={{
                  fontFamily: heading?.fontFamily || heading?.name,
                  fontWeight: preset.fonts?.headingWeight,
                  color: neutral,
                }}
              >
                Aa
              </span>
              <span className="pp-button pp-button--primary pp-color-primary pp-size-xs pb-theme-btn">
                Button
              </span>
              <PaletteCluster
                colors={[
                  neutral,
                  preset.colors.primary,
                  preset.colors.secondary,
                  preset.colors.tertiary,
                ]}
                ring={preset.colors.background}
              />
            </button>
          );
        })}
      </div>
    </>
  );
}
