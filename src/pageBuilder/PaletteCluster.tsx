/**
 * The reusable color-swatch cluster: overlapping circles, leftmost on top,
 * each ringed in the surrounding background — pagy's palette look. One
 * component for everywhere swatches cluster (the Design Colors tile, the
 * Colors panel's Palettes grid, and the Themes preset tiles).
 *
 *   • `colors`  — the swatch colors in paint order; falsy entries are skipped.
 *   • `ring`    — the gap color between circles (usually the container bg);
 *                 defaults to white.
 *   • `size`    — circle diameter in px (overlap scales with it).
 *
 * `ring`/`size`/`background` are per-instance dynamic values, so they ride
 * inline custom props rather than utility classes.
 */

import type { CSSProperties } from "react";

export function PaletteCluster({
  colors,
  ring,
  size = 24,
}: {
  colors: (string | undefined)[];
  ring?: string;
  size?: number;
}) {
  const visible = colors.filter((c): c is string => Boolean(c));
  const style = {
    "--swatch-size": `${size}px`,
    ...(ring ? { "--cluster-ring": ring } : {}),
  } as CSSProperties;
  return (
    <span className="pb-palette-cluster" style={style}>
      {visible.map((color, i) => (
        // zIndex descending so the leftmost circle sits on top.
        <span key={i} style={{ background: color, zIndex: visible.length - i }} />
      ))}
    </span>
  );
}
