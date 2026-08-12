/**
 * Hotspot — region geometry. A region is a rectangle or a point the author
 * draws on the image; coordinates are NORMALIZED (0..1, fractions of the image
 * box) so they're resolution-independent — the same region maps correctly at any
 * rendered size, on the canvas and the published site. Pure (no React beyond the
 * style type) so the completer, the builder, serialize, and grading all agree.
 */

import type { CSSProperties } from "react";

import { newId } from "../shared/ids";

export type RegionShape = "rect" | "point";

export interface HotspotRegion {
  id: string;
  shape: RegionShape;
  /** Normalized 0..1. For a rect this is the top-left; for a point, the center. */
  x: number;
  y: number;
  /** Normalized 0..1 size (rect only; 0 for a point). */
  w: number;
  h: number;
  /** Answer key: is clicking this region correct? */
  correct: boolean;
}

export const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

export function newRegion(partial: Partial<HotspotRegion>): HotspotRegion {
  return {
    id: newId("region"),
    shape: "rect",
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    correct: true,
    ...partial,
  };
}

/** Coerce stored JSON (which may be loose) into a clean region. */
export function coerceRegion(raw: unknown): HotspotRegion | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const shape: RegionShape = r["shape"] === "point" ? "point" : "rect";
  const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : 0);
  return {
    id: typeof r["id"] === "string" && r["id"] ? r["id"] : newId("region"),
    shape,
    x: clamp01(num(r["x"])),
    y: clamp01(num(r["y"])),
    w: shape === "point" ? 0 : clamp01(num(r["w"])),
    h: shape === "point" ? 0 : clamp01(num(r["h"])),
    correct: r["correct"] !== false,
  };
}

export function coerceRegions(raw: unknown): HotspotRegion[] {
  return Array.isArray(raw)
    ? raw.map(coerceRegion).filter((r): r is HotspotRegion => !!r)
    : [];
}

/** Normalized click tolerance around a point region (find mode hit-testing). */
export const POINT_HIT_RADIUS = 0.05;

/** Does a normalized click (px,py) land in this region? A rect is its box; a
 *  point is a small square of ±POINT_HIT_RADIUS around its center. Pure — shared
 *  by find-mode grading and the completer's marker coloring. */
export function regionContains(r: HotspotRegion, px: number, py: number): boolean {
  if (r.shape === "point") {
    return (
      Math.abs(px - r.x) <= POINT_HIT_RADIUS &&
      Math.abs(py - r.y) <= POINT_HIT_RADIUS
    );
  }
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

/** CSS box for a region inside a `position: relative` image wrapper. A point is
 *  centered on (x,y) by the CSS (`translate(-50%,-50%)`); a rect spans w×h. */
export function regionStyle(r: HotspotRegion): CSSProperties {
  if (r.shape === "point") {
    return { left: `${r.x * 100}%`, top: `${r.y * 100}%` };
  }
  return {
    left: `${r.x * 100}%`,
    top: `${r.y * 100}%`,
    width: `${r.w * 100}%`,
    height: `${r.h * 100}%`,
  };
}

/** Normalize a rect drawn between two pointer points (handles any drag direction)
 *  into a top-left + size, clamped to the image box. */
export function rectFromPoints(
  ax: number,
  ay: number,
  bx: number,
  by: number,
): { x: number; y: number; w: number; h: number } {
  const x = clamp01(Math.min(ax, bx));
  const y = clamp01(Math.min(ay, by));
  return {
    x,
    y,
    w: clamp01(Math.abs(bx - ax)),
    h: clamp01(Math.abs(by - ay)),
  };
}
