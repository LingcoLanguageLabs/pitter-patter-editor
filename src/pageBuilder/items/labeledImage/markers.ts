/**
 * Labeled image — marker geometry + content. A marker is a POINT the author
 * drops on the image (the content cousin of a Hotspot region, minus the
 * correct/distractor answer key). Coordinates are NORMALIZED (0..1, fractions of
 * the image box) so they're resolution-independent — the same marker maps
 * correctly at any rendered size, on the canvas and the published site. Each
 * marker carries the content shown when it's selected: a `label` (title) and a
 * `body` (description). Pure (no React beyond the style type) so the completer,
 * the builder, and serialize all agree.
 */

import type { CSSProperties } from "react";

import { newId } from "../shared/ids";

export interface LabeledMarker {
  id: string;
  /** Normalized 0..1 — the marker's center. */
  x: number;
  y: number;
  /** Short title, shown in the info panel + as the chip label. */
  label: string;
  /** Description, shown in the panel when this marker is selected. Plain text. */
  body: string;
}

export const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

export function newMarker(partial: Partial<LabeledMarker>): LabeledMarker {
  return { id: newId("marker"), x: 0.5, y: 0.5, label: "", body: "", ...partial };
}

/** Coerce stored JSON (which may be loose) into a clean marker. */
export function coerceMarker(raw: unknown): LabeledMarker | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : 0);
  return {
    id: typeof r["id"] === "string" && r["id"] ? r["id"] : newId("marker"),
    x: clamp01(num(r["x"])),
    y: clamp01(num(r["y"])),
    label: typeof r["label"] === "string" ? r["label"] : "",
    body: typeof r["body"] === "string" ? r["body"] : "",
  };
}

export function coerceMarkers(raw: unknown): LabeledMarker[] {
  return Array.isArray(raw)
    ? raw.map(coerceMarker).filter((m): m is LabeledMarker => !!m)
    : [];
}

/** CSS position for a marker inside a `position: relative` image wrapper. The
 *  marker is centered on (x,y) by the CSS (`translate(-50%,-50%)`). */
export function markerStyle(m: LabeledMarker): CSSProperties {
  return { left: `${m.x * 100}%`, top: `${m.y * 100}%` };
}
