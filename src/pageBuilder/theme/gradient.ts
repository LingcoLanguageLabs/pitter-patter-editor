/**
 * CSS gradient + colour parsing — the pure, dependency-light helper behind the
 * ColorPicker's gradient mode and its "edit as CSS" box. No React, no theme
 * concepts; just `string ⇄ GradientSpec` and `any CSS colour → hex`, so it can
 * be unit-tested in isolation (see `gradient.test.ts`).
 *
 *   normalizeColor("rgb(255 0 0 / 50%)") → "#ff000080"
 *   parseGradient("radial-gradient(120% 80% at 80% 0%, #fff 0%, #eee 60%)")
 *   gradientToCss(spec) → canonical CSS string
 *
 * Colour normalisation leans on chroma-js for the formats it parses (hex 3/4/6/8,
 * legacy `rgb()/hsl()`, named, transparent) and hand-handles the modern
 * space-separated `rgb()/hsl()` syntax (with optional `/ alpha`) that older
 * chroma builds reject.
 */

import chroma from "chroma-js";

export type GradientType = "linear" | "radial" | "conic";

export interface GradientStop {
  /** Hex, possibly 8-digit when the stop is translucent. */
  color: string;
  /** 0–100. */
  pos: number;
}

export interface GradientSpec {
  type: GradientType;
  /** Degrees, for linear & conic. CSS convention: 0 = up, 90 = right. */
  angle: number;
  /** Center, percent — for radial & conic. */
  posX: number;
  posY: number;
  /** Radial extent verbatim (e.g. "120% 80%" or "circle"), preserved so pasted
   *  CSS round-trips. The visual controls don't edit it. */
  size?: string;
  stops: GradientStop[];
}

const GRADIENT_RE = /(?:^|\s)(?:linear|radial|conic)-gradient\(/;

export function isGradient(v: string | null | undefined): boolean {
  return !!v && GRADIENT_RE.test(v);
}

/* ── Colour normalisation ──────────────────────────────────────────── */

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

function toHex(c: chroma.Color): string {
  return c.alpha() < 1 ? c.hex("rgba") : c.hex("rgb");
}

/** "50%" → 0.5, "0.5" → 0.5, "none"/garbage → 1. */
function parseAlpha(a: string): number {
  const t = a.trim();
  const n = t.endsWith("%") ? parseFloat(t) / 100 : parseFloat(t);
  return Number.isFinite(n) ? clamp01(n) : 1;
}

/** rgb channel: "50%" → 127.5, "255" → 255. */
function rgbChannel(c: string): number {
  const t = c.trim();
  return t.endsWith("%") ? (parseFloat(t) / 100) * 255 : parseFloat(t);
}

/** hsl saturation/lightness: "50%" → 0.5, "50" → 0.5. */
function pct(c: string): number {
  return parseFloat(c) / 100;
}

/** Hue in deg / turn / rad / grad / unitless → degrees. */
function parseHue(h: string): number {
  const t = h.trim();
  if (t.endsWith("turn")) return parseFloat(t) * 360;
  if (t.endsWith("grad")) return parseFloat(t) * 0.9;
  if (t.endsWith("rad")) return (parseFloat(t) * 180) / Math.PI;
  return parseFloat(t); // "120deg" or "120"
}

/**
 * Any CSS colour → canonical hex (`#rrggbb`, or `#rrggbbaa` when translucent),
 * or null if it can't be parsed.
 */
export function normalizeColor(input: string): string | null {
  if (!input) return null;
  const s = input.trim();
  if (!s) return null;

  // Fast path — chroma handles hex (3/4/6/8), legacy comma rgb()/hsl(), named
  // colours and `transparent`.
  try {
    if (chroma.valid(s)) return toHex(chroma(s));
  } catch {
    /* fall through to the modern-syntax handler */
  }

  // Modern functional syntax: `rgb(255 0 0 / 50%)`, `hsl(120 50% 50% / .5)`.
  const fn = s.match(/^(rgba?|hsla?)\(([^)]*)\)$/i);
  if (!fn) return null;
  const isHsl = fn[1]!.toLowerCase().startsWith("hsl");

  let body = fn[2]!.trim();
  let alpha = 1;
  const slash = body.indexOf("/");
  if (slash >= 0) {
    alpha = parseAlpha(body.slice(slash + 1));
    body = body.slice(0, slash).trim();
  }

  const parts = body.split(/[\s,]+/).filter(Boolean);
  if (parts.length < 3) return null;
  if (slash < 0 && parts.length >= 4) alpha = parseAlpha(parts[3]!); // legacy 4th component

  try {
    const base = isHsl
      ? chroma.hsl(parseHue(parts[0]!), pct(parts[1]!), pct(parts[2]!))
      : chroma(rgbChannel(parts[0]!), rgbChannel(parts[1]!), rgbChannel(parts[2]!), "rgb");
    return toHex(base.alpha(alpha));
  } catch {
    return null;
  }
}

/* ── Gradient parsing / serialisation ──────────────────────────────── */

/** Split on `sep` at paren depth 0, so commas inside `rgb(…)` stay intact. */
function splitTopLevel(s: string, sep = ","): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === sep && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** "rgb(1 2 3) 50%" → {color:"#…", pos:50}; pos null when absent. */
function parseStopLoose(s: string): { color: string; pos: number | null } | null {
  const m = s.match(/\s+(-?[\d.]+)%\s*$/);
  let color = s;
  let pos: number | null = null;
  if (m && m.index != null) {
    pos = parseFloat(m[1]!);
    color = s.slice(0, m.index).trim();
  }
  const hex = normalizeColor(color);
  if (!hex) return null;
  return { color: hex, pos };
}

const DIRECTIONS: Record<string, number> = {
  "to top": 0,
  "to right": 90,
  "to bottom": 180,
  "to left": 270,
  "to top right": 45,
  "to right top": 45,
  "to bottom right": 135,
  "to right bottom": 135,
  "to bottom left": 225,
  "to left bottom": 225,
  "to top left": 315,
  "to left top": 315,
};

export function parseGradient(value: string): GradientSpec | null {
  // Tolerate a trailing `;` and surrounding whitespace (pasted CSS often has them).
  const m = value
    .trim()
    .replace(/;+\s*$/, "")
    .match(/^(linear|radial|conic)-gradient\(([\s\S]*)\)$/);
  if (!m) return null;
  const type = m[1] as GradientType;
  const parts = splitTopLevel(m[2]!);
  if (parts.length < 2) return null;

  let angle = type === "linear" ? 180 : 0;
  let posX = 50;
  let posY = 50;
  let size: string | undefined;
  let stopParts = parts;

  // A leading configuration segment (angle / direction / position / shape /
  // size) is anything that doesn't parse as a colour stop.
  const head = parts[0]!;
  const headIsStop = parseStopLoose(head);
  if (!headIsStop || /\b(?:deg|to|at|from|circle|ellipse|closest|farthest)\b/.test(head)) {
    stopParts = parts.slice(1);
    const deg = head.match(/(-?[\d.]+)deg/);
    if (deg) angle = parseFloat(deg[1]!);
    else if (DIRECTIONS[head.trim()] != null) angle = DIRECTIONS[head.trim()]!;
    const at = head.match(/at\s+([\d.]+)%\s+([\d.]+)%/);
    if (at) {
      posX = parseFloat(at[1]!);
      posY = parseFloat(at[2]!);
    }
    // Radial extent (shape / explicit radii like "120% 80%") sits before `at`.
    if (type === "radial") {
      const ext = head.split(/\s+at\s+/)[0]!.trim();
      if (ext && !/deg/.test(ext)) size = ext;
    }
  }

  const raw = stopParts
    .map(parseStopLoose)
    .filter((s): s is { color: string; pos: number | null } => !!s);
  if (raw.length < 2) return null;

  const n = raw.length;
  const stops: GradientStop[] = raw.map((r, i) => ({
    color: r.color,
    pos: r.pos ?? (n > 1 ? (i / (n - 1)) * 100 : 0),
  }));

  return { type, angle, posX, posY, size, stops };
}

const round = (n: number) => Math.round(n * 10) / 10;

function stopList(stops: GradientStop[]): string {
  return stops
    .slice()
    .sort((a, b) => a.pos - b.pos)
    .map((s) => `${s.color} ${round(s.pos)}%`)
    .join(", ");
}

export function gradientToCss(g: GradientSpec): string {
  const stops = stopList(g.stops);
  if (g.type === "linear") return `linear-gradient(${round(g.angle)}deg, ${stops})`;
  if (g.type === "conic") {
    return `conic-gradient(from ${round(g.angle)}deg at ${round(g.posX)}% ${round(g.posY)}%, ${stops})`;
  }
  const ext = g.size ? `${g.size} ` : "";
  return `radial-gradient(${ext}at ${round(g.posX)}% ${round(g.posY)}%, ${stops})`;
}

/** A left→right ramp of the stops, for the editor preview bar (independent of
 *  the gradient's real angle/type). */
export function stopsToBarCss(stops: GradientStop[]): string {
  return `linear-gradient(90deg, ${stopList(stops)})`;
}

/** Interpolated colour at `pos` (0–100) along the current stops — used when
 *  adding a stop by clicking the bar. */
export function colorAt(stops: GradientStop[], pos: number): string {
  const sorted = stops.slice().sort((a, b) => a.pos - b.pos);
  if (sorted.length === 0) return "#ffffff";
  if (sorted.length === 1) return sorted[0]!.color;
  const scale = chroma
    .scale(sorted.map((s) => s.color))
    .domain(sorted.map((s) => s.pos / 100));
  return scale(pos / 100).hex();
}
