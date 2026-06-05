// Theme → CSS helpers, unminified from module 791646.
//
//   `tf` (0134) → safeShadowColor
//   `ty` (0135) → neutralAlphaOffsetPct
//   `tv` (0138) → themeToCss
//   `tp` (0132) → themeClassName
//
// `themeToCss` is the function that converts a site theme (colours + fonts +
// button/input style tokens) into a stringified `<style>` block rendered
// inside the iframe. The shipped editor calls it in two places:
//   1. `<Editor oR>` — emits the active site theme into the iframe.
//   2. `<ThemePreviewFrame>` (`nP`) — emits a per-preview theme into a
//      dedicated preview frame.
//
// Contrast decisions: each theme variant picks a "safe" foreground + a
// readable primary based on `hasLowContrast`. The logic is preserved
// verbatim — same branching, same CSS variable names — so the output
// matches the shipped site.css exactly.

import chroma from "chroma-js";

import { hasLowContrast } from "./contrast";
import { FONTS_DEFAULT, FONTS_PRO, type FontDef } from "./fonts";

export interface Theme {
  colors: {
    background: string;
    neutral?: string;
    text?: string;
    primary: string;
    secondary?: string;
    tertiary?: string;
  };
  fonts?: {
    base?: string;
    heading?: string;
    headingWeight?: string | number;
    headingSize?: number;
  };
  buttons?: { radius?: string; style?: string };
  inputs?: { shape?: string; style?: string };
}

/** Original name: `tf`. Returns whichever of the two colors has lower luminance. */
export function safeShadowColor(a: string, b: string): string {
  return chroma(a).luminance() < chroma(b).luminance() ? a : b;
}

/**
 * Original name: `ty`. Dials the "alpha offset neutral" CSS var — makes
 * translucent overlays read correctly on both light and dark themes.
 *
 * The formula comes straight from the bundle; don't normalise it without
 * diffing rendered output against the shipped CSS.
 */
export function neutralAlphaOffsetPct(a: string, b: string): number {
  const blackContrast = chroma.contrast(a, "#000");
  return Math.round(
    1 / (chroma.contrast(a, b) / 14) +
      4 * Number(chroma(a).luminance() < chroma(b).luminance()) +
      4 * Number(blackContrast < 1.2),
  );
}

/** Original name: `tp`. */
export function themeClassName(theme: Theme): string {
  return `
  button-style-${theme.buttons?.style} button-radius-${theme.buttons?.radius}
  input-shape-${theme.inputs?.shape} input-style-${theme.inputs?.style}`;
}

function findFont(name: string | undefined): FontDef | undefined {
  if (!name) return undefined;
  return FONTS_DEFAULT.find((f) => f.name === name) || FONTS_PRO.find((f) => f.name === name);
}

/** Original name: `tv`. */
export function themeToCss(theme: Theme): string {
  const body = findFont(theme.fonts?.base);
  const heading = findFont(theme.fonts?.heading);
  const { background: bg, primary, secondary, tertiary } = theme.colors;
  const neutral = theme.colors.neutral || theme.colors.text;

  if (!primary || !bg || !neutral) return "";

  // For each accent colour, pick the legible foreground (neutral or bg)
  // given the inversion state.
  const invertedForBg = chroma(bg).luminance() < chroma(neutral).luminance();
  const pick = (accent: string | undefined) =>
    invertedForBg
      ? hasLowContrast(accent, neutral)
        ? neutral
        : bg
      : hasLowContrast(accent, bg)
        ? bg
        : neutral;

  const primaryFg = pick(primary);
  const secondaryFg = pick(secondary);
  const tertiaryFg = pick(tertiary);

  return `
    .site {
      ${body && `--font-family-base: ${body.fontFamily || body.name}, ${body.type};`}
      ${body && `--font-size-base-offset: ${body.offset}px;`}
      ${body && `--font-weight-base: ${body.regular || 400};`}

      ${heading && `--font-family-heading: ${heading.fontFamily || heading.name}, ${body?.type};`}
      ${heading && `--font-weight-heading: ${theme.fonts?.headingWeight};`}

      ${body && `--font-size-offset: ${body.offset}px;`}
      ${heading && `--font-size-heading-offset: ${heading.offset}px;`}

      --color-background: ${bg};
      --color-neutral: ${neutral};

      --color-primary: ${primary};
      --color-secondary: ${secondary};
      --color-tertiary: ${tertiary};

      --color-neutral-surface: ${neutral};
      --color-neutral-foreground: ${bg};
      --color-neutral-safe: ${neutral};

      --color-primary-surface: ${primary};
      --color-primary-foreground: ${primaryFg};
      --color-primary-safe: ${hasLowContrast(primary, bg) ? primary : neutral};

      --color-secondary-surface: ${secondary};
      --color-secondary-foreground: ${secondaryFg};
      --color-secondary-safe: ${hasLowContrast(secondary, bg) ? secondary : neutral};

      --color-tertiary-surface: ${tertiary};
      --color-tertiary-foreground: ${tertiaryFg};
      --color-tertiary-safe: ${hasLowContrast(tertiary, bg) ? tertiary : neutral};

      --color-shadow: ${invertedForBg ? "#000" : neutral};

      --alpha-offset-neutral: ${neutralAlphaOffsetPct(bg, neutral)}%;
    }

    .theme.-default {
      --color-background: ${bg};
      --color-neutral: ${neutral};

      --color-primary: ${primary};
      --color-secondary: ${secondary};
      --color-tertiary: ${tertiary};

      --color-neutral-surface: ${neutral};
      --color-neutral-foreground: ${bg};
      --color-neutral-safe: ${neutral};

      --color-primary-surface: ${primary};
      --color-primary-foreground: ${primaryFg};
      --color-primary-safe: ${hasLowContrast(primary, bg) ? primary : neutral};

      --color-secondary-surface: ${secondary};
      --color-secondary-foreground: ${secondaryFg};
      --color-secondary-safe: ${hasLowContrast(secondary, bg) ? secondary : neutral};

      --color-tertiary-surface: ${tertiary};
      --color-tertiary-foreground: ${tertiaryFg};
      --color-tertiary-safe: ${hasLowContrast(tertiary, bg) ? tertiary : neutral};

      --color-shadow: ${invertedForBg ? "#000" : neutral};
      --alpha-offset-neutral: ${neutralAlphaOffsetPct(bg, neutral)}%;
    }

    .theme.-inverted {
      --color-background: ${neutral};
      --color-neutral: ${bg};

      --color-neutral-surface: ${bg};
      --color-neutral-foreground: ${neutral};
      --color-neutral-safe: ${bg};

      --color-primary-surface: ${primary};
      --color-primary-foreground: ${primaryFg};
      --color-primary-safe: ${hasLowContrast(primary, neutral) ? primary : bg};

      --color-secondary-surface: ${secondary};
      --color-secondary-foreground: ${secondaryFg};
      --color-secondary-safe: ${hasLowContrast(secondary, neutral) ? secondary : bg};

      --color-tertiary-surface: ${tertiary};
      --color-tertiary-foreground: ${tertiaryFg};
      --color-tertiary-safe: ${hasLowContrast(tertiary, neutral) ? tertiary : bg};

      --color-shadow: ${invertedForBg ? neutral : "#000"};

      --alpha-offset-neutral: ${neutralAlphaOffsetPct(neutral, bg)}%;
    }

    .theme.-primary {
      --color-background: ${primary};
      --color-neutral: ${primaryFg};

      --color-primary: ${primaryFg};
      --color-secondary: ${secondary};
      --color-tertiary: ${tertiary};

      --color-neutral-surface: ${neutral};
      --color-neutral-foreground: ${bg};
      --color-neutral-safe: ${primaryFg};

      --color-primary-surface: ${primaryFg};
      --color-primary-foreground: ${primary};
      --color-primary-safe: ${primaryFg};

      --color-secondary-surface: ${secondary};
      --color-secondary-foreground: ${secondaryFg};
      --color-secondary-safe: ${hasLowContrast(secondary, primary) ? secondary : primaryFg};

      --color-tertiary-surface: ${tertiary};
      --color-tertiary-foreground: ${tertiaryFg};
      --color-tertiary-safe: ${hasLowContrast(tertiary, primary) ? tertiary : primaryFg};

      --color-shadow: ${safeShadowColor(neutral, bg)};

      --alpha-offset-neutral: ${neutralAlphaOffsetPct(primary, primaryFg)}%;
    }

    ${
      secondary
        ? `
    .theme.-secondary {
      --color-background: ${secondary};
      --color-neutral: ${secondaryFg};

      --color-primary: ${primary};
      --color-secondary: ${secondaryFg};
      --color-tertiary: ${tertiary};

      --color-neutral-surface: ${neutral};
      --color-neutral-foreground: ${bg};
      --color-neutral-safe: ${secondaryFg};

      --color-primary-surface: ${primary};
      --color-primary-foreground: ${primaryFg};
      --color-primary-safe: ${hasLowContrast(primary, secondary) ? primary : secondaryFg};

      --color-secondary-surface: ${secondaryFg};
      --color-secondary-foreground: ${secondary};
      --color-secondary-safe: ${secondaryFg};

      --color-tertiary-surface: ${tertiary};
      --color-tertiary-foreground: ${tertiaryFg};
      --color-tertiary-safe: ${hasLowContrast(tertiary, secondary) ? tertiary : secondaryFg};

      --color-shadow: ${safeShadowColor(neutral, bg)};

      --alpha-offset-neutral: ${neutralAlphaOffsetPct(secondary, secondaryFg)}%;
    }`
        : ""
    }

    ${
      tertiary
        ? `
    .theme.-tertiary {
      --color-background: ${tertiary};
      --color-neutral: ${tertiaryFg};

      --color-primary: ${primary};
      --color-secondary: ${secondary};
      --color-tertiary: ${tertiaryFg};

      --color-neutral-surface: ${neutral};
      --color-neutral-foreground: ${bg};
      --color-neutral-safe: ${tertiaryFg};

      --color-primary-surface: ${primary};
      --color-primary-foreground: ${primaryFg};
      --color-primary-safe: ${hasLowContrast(primary, tertiary) ? primary : tertiaryFg};

      --color-secondary-surface: ${secondary};
      --color-secondary-foreground: ${secondaryFg};
      --color-secondary-safe: ${hasLowContrast(secondary, tertiary) ? secondary : tertiaryFg};

      --color-tertiary-surface: ${tertiaryFg};
      --color-tertiary-foreground: ${tertiary};
      --color-tertiary-safe: ${tertiaryFg};

      --color-shadow: ${safeShadowColor(neutral, bg)};

      --alpha-offset-neutral: ${neutralAlphaOffsetPct(tertiary, tertiaryFg)}%;
    }`
        : ""
    }
  `;
}
