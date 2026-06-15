/**
 * Page-transition catalog + animation engine — the "Transitions" feature
 * (PowerPoint / Keynote style), played when the deck advances from one page to
 * the next while *viewing* the site (the `<SiteRenderer>` render path, used by
 * both the preview overlay and the published site). ProseMirror is the
 * authoring runtime only; the editor canvas switches pages instantly.
 *
 * Each page stores its choice as `page` node attrs: `transition` (the catalog
 * id), `transitionVariant` (the "Effect Option", e.g. From Left), and
 * `transitionSpeed`. The transition plays on *entry* to a page.
 *
 * Catalog (`TRANSITIONS`): the full PowerPoint set grouped Subtle / Exciting /
 * Dynamic, plus the clip/wipe family from motion.dev's page-transition
 * examples (folded into Subtle/Exciting). Every entry has a name, group, and
 * optional Effect Options. `FAMILY[id]` maps each id to an animation family;
 * `buildPageMotion()` turns (id, variant, direction) into the motion
 * `initial`/`animate`/`exit` objects `<SiteRenderer>` feeds `<motion.div>`.
 *
 * Animation coverage: the transform / clip-path / opacity families are
 * implemented faithfully with their Effect Options. The exotic 3D/particle
 * effects (Origami, Fracture, Cube-mesh, Vortex…) map to `fallback` — a tasteful
 * default — until each is built out individually. Adding/upgrading one is a
 * `FAMILY` entry + a `case` in `buildPageMotion`.
 */

import type { TargetAndTransition, Transition } from "motion/react";

// ────────────────────────────────────────────────────────────────
// Speed
// ────────────────────────────────────────────────────────────────

export const TRANSITION_SPEED_VALUES = ["fast", "medium", "slow"] as const;
export type TransitionSpeed = (typeof TRANSITION_SPEED_VALUES)[number];

export const TRANSITION_SPEED_LABELS: Record<TransitionSpeed, string> = {
  fast: "Fast",
  medium: "Medium",
  slow: "Slow",
};

export const TRANSITION_DURATION_SEC: Record<TransitionSpeed, number> = {
  fast: 0.3,
  medium: 0.55,
  slow: 0.9,
};

export function transitionDurationSec(speed: TransitionSpeed): number {
  return TRANSITION_DURATION_SEC[speed] ?? TRANSITION_DURATION_SEC.medium;
}

export const TRANSITION_EASE: [number, number, number, number] = [0.4, 0, 0.2, 1];

/** Framer Motion `transition` (timing) for a given speed. */
export function transitionTiming(
  speed: TransitionSpeed,
  override?: Partial<Transition>,
): Transition {
  return { duration: transitionDurationSec(speed), ease: TRANSITION_EASE, ...override };
}

/** Navigation direction — forward (next page) reverses backward. */
export type TransitionDirection = "forward" | "backward";

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
  );
}

// ────────────────────────────────────────────────────────────────
// Catalog
// ────────────────────────────────────────────────────────────────

export type TransitionGroup = "subtle" | "exciting" | "dynamic";

/** An "Effect Option" — the variants PowerPoint exposes per transition. */
export interface TransitionVariant {
  id: string;
  label: string;
}

export interface TransitionDef {
  id: string;
  label: string;
  group: TransitionGroup;
  /** Effect Options shown on hover; the first is the default. */
  variants?: readonly TransitionVariant[];
}

// Shared Effect-Option sets.
const DIRECTIONS: readonly TransitionVariant[] = [
  { id: "from-right", label: "From Right" },
  { id: "from-left", label: "From Left" },
  { id: "from-bottom", label: "From Bottom" },
  { id: "from-top", label: "From Top" },
];
const LR_VARIANTS: readonly TransitionVariant[] = [
  { id: "from-right", label: "From Right" },
  { id: "from-left", label: "From Left" },
];
const CLOCK_VARIANTS: readonly TransitionVariant[] = [
  { id: "clockwise", label: "Clockwise" },
  { id: "counterclockwise", label: "Counterclockwise" },
];

// ── Curtains (Motion+) Effect Options ───────────────────────────────────────
// These mirror the option surface of the real `motion-plus-dom/curtains`
// factories (see `runtime/curtainsEffects.ts`): a directional effect takes a
// travel `direction`, iris an `origin`, blinds a row/column `direction`, and
// pixels a fill `order`. Each preset id maps 1:1 to a concrete option value.
const IRIS_ORIGINS: readonly TransitionVariant[] = [
  { id: "center", label: "Center" },
  { id: "top-left", label: "Top Left" },
  { id: "top-right", label: "Top Right" },
  { id: "bottom-left", label: "Bottom Left" },
  { id: "bottom-right", label: "Bottom Right" },
];
const PIXELS_ORDERS: readonly TransitionVariant[] = [
  { id: "random", label: "Random" },
  { id: "rows", label: "Rows" },
  { id: "columns", label: "Columns" },
  { id: "diagonal", label: "Diagonal" },
  { id: "radial", label: "Radial" },
];
const BLINDS_DIRS: readonly TransitionVariant[] = [
  { id: "rows", label: "Rows" },
  { id: "columns", label: "Columns" },
];

/**
 * The catalog — deduplicated and curated. Each effect appears exactly once,
 * grouped by intensity (Subtle / Exciting / Dynamic). Where an effect exists in
 * both the Framer-Motion set and Motion+'s Curtains library, the Curtains
 * implementation wins (the real, faithful library transition) and carries the
 * canonical label — so "Fade", "Wipe", "Doors", "Iris", "Blinds" and "Pixels"
 * are `curtains-*` ids routed through `runtime/curtainsEffects.ts`. The earlier
 * long tail of look-alike approximations (5 identical scale+blur "shatter"
 * effects, 8 identical 3D-rotation "fold" effects, family clones like
 * Switch/Window, Rotate, Conveyor/Ferris/Orbit, Pan, Vortex, Prestige) was
 * removed. `none` is first and special-cased everywhere (instant, no animation).
 */
export const TRANSITIONS: readonly TransitionDef[] = [
  // ── Subtle — gentle, professional ───────────────────────
  { id: "none", label: "None", group: "subtle" },
  { id: "curtains-fade", label: "Fade", group: "subtle" },
  { id: "morph", label: "Morph", group: "subtle" },
  { id: "cut", label: "Cut", group: "subtle" },
  { id: "push", label: "Push", group: "subtle", variants: DIRECTIONS },
  { id: "cover", label: "Cover", group: "subtle", variants: DIRECTIONS },
  { id: "reveal", label: "Reveal", group: "subtle", variants: LR_VARIANTS },

  // ── Exciting — clip / reveal / geometric ────────────────
  { id: "curtains-wipe", label: "Wipe", group: "exciting", variants: DIRECTIONS },
  { id: "curtains-doors", label: "Doors", group: "exciting", variants: DIRECTIONS },
  { id: "curtains-iris", label: "Iris", group: "exciting", variants: IRIS_ORIGINS },
  { id: "curtains-blinds", label: "Blinds", group: "exciting", variants: BLINDS_DIRS },
  { id: "curtains-pixels", label: "Pixels", group: "exciting", variants: PIXELS_ORDERS },
  { id: "flash", label: "Flash", group: "exciting" },

  // ── Dynamic — 3D & dramatic ─────────────────────────────
  { id: "flip", label: "Flip", group: "dynamic", variants: LR_VARIANTS },
  { id: "cube", label: "Cube", group: "dynamic", variants: DIRECTIONS },
  { id: "gallery", label: "Gallery", group: "dynamic", variants: LR_VARIANTS },
  { id: "clock", label: "Clock", group: "dynamic", variants: CLOCK_VARIANTS },
] as const;

export type TransitionType = (typeof TRANSITIONS)[number]["id"];

/** id → def, for O(1) lookups. */
export const TRANSITION_BY_ID: Record<string, TransitionDef> = Object.fromEntries(
  TRANSITIONS.map((t) => [t.id, t]),
);

export const TRANSITION_GROUPS: { id: TransitionGroup; label: string }[] = [
  { id: "subtle", label: "Subtle" },
  { id: "exciting", label: "Exciting" },
  { id: "dynamic", label: "Dynamic" },
];

/** Default Effect Option for a transition (its first variant, or ""). */
export function defaultVariant(id: string): string {
  return TRANSITION_BY_ID[id]?.variants?.[0]?.id ?? "";
}

export function transitionLabel(id: string): string {
  return TRANSITION_BY_ID[id]?.label ?? "None";
}

// ────────────────────────────────────────────────────────────────
// Animation engine
// ────────────────────────────────────────────────────────────────

/** Animation family — how an id animates. Every catalog id maps to one. */
type Family =
  | "fade"
  | "push"
  | "cover"
  | "wipe"
  | "split"
  | "shape"
  | "bars"
  | "flip"
  | "cube"
  | "gallery"
  | "reveal"
  | "cut"
  | "flash"
  | "spin"
  | "shatter";

/** Maps every catalog id to an animation family. The motion.dev clip/wipe set
 *  (wipe, iris, doors, blinds, shutter, stagger-wipe, …) gets real `clip-path`
 *  animations; the exotic PowerPoint effects get distinct 3D / blur / spin
 *  approximations. Nothing is a stub. */
const FAMILY: Record<string, Family> = {
  none: "cut",
  cut: "cut",
  morph: "fade",
  flash: "flash",
  push: "push",
  cover: "cover",
  reveal: "reveal",
  flip: "flip",
  cube: "cube",
  gallery: "gallery",
  clock: "spin",
  // Curtains-backed effects (the canonical Fade/Wipe/Doors/Iris/Blinds/Pixels).
  // These FAMILY entries only feed the gallery's small hover preview (a
  // Framer-Motion approximation); the real deck transition runs the actual
  // `curtains()` library via SiteRenderer.
  "curtains-fade": "fade",
  "curtains-wipe": "wipe",
  "curtains-doors": "split",
  "curtains-iris": "shape",
  "curtains-blinds": "bars",
  "curtains-pixels": "shatter",
};

/** The motion triple for one page's `<motion.div>`. */
export interface PageMotion {
  initial: TargetAndTransition;
  animate: TargetAndTransition;
  exit: TargetAndTransition;
}

/** Fully-visible resting state (entering page settles here / leaving starts here). */
const REST: TargetAndTransition = {
  x: "0%",
  y: "0%",
  opacity: 1,
  scale: 1,
  rotate: 0,
  rotateX: 0,
  rotateY: 0,
  skewX: 0,
  filter: "blur(0px) brightness(1)",
  clipPath: "inset(0% 0% 0% 0%)",
  zIndex: 1,
};

/** Axis offset for a directional variant, flipped for backward nav. */
function dirOffset(variant: string, dir: TransitionDirection): { axis: "x" | "y"; from: string; to: string } {
  const back = dir === "backward";
  switch (variant) {
    case "from-left":
      return { axis: "x", from: back ? "100%" : "-100%", to: back ? "-100%" : "100%" };
    case "from-top":
      return { axis: "y", from: back ? "100%" : "-100%", to: back ? "-100%" : "100%" };
    case "from-bottom":
      return { axis: "y", from: back ? "-100%" : "100%", to: back ? "100%" : "-100%" };
    case "from-right":
    default:
      return { axis: "x", from: back ? "-100%" : "100%", to: back ? "100%" : "-100%" };
  }
}

/** Clip-away inset for a wipe direction (rest = inset 0; leaving shrinks here). */
function wipeExitInset(variant: string, dir: TransitionDirection): string {
  const back = dir === "backward";
  // inset(top right bottom left) — 100% on a side hides from that side.
  switch (variant) {
    case "from-left":
      return back ? "inset(0 0 0 100%)" : "inset(0 100% 0 0)";
    case "from-top":
      return back ? "inset(0 0 100% 0)" : "inset(100% 0 0 0)";
    case "from-bottom":
      return back ? "inset(100% 0 0 0)" : "inset(0 0 100% 0)";
    case "from-right":
    default:
      return back ? "inset(0 100% 0 0)" : "inset(0 0 0 100%)";
  }
}

/**
 * A `clip-path: polygon()` of `count` parallel bars filling `open` (0..1) of
 * each slice — the blinds/shutter clip. At open=1 the bars tile to full
 * coverage; at 0 they collapse to lines. Both endpoints have the same point
 * count, so motion can interpolate between them. Disjoint bars are joined by
 * zero-width segments along the x=0 (horizontal) / y=0 (vertical) edge.
 */
function barsPolygon(count: number, open: number, horizontal: boolean): string {
  const slice = 100 / count;
  const pts: string[] = [];
  for (let i = 0; i < count; i++) {
    const center = (i + 0.5) * slice;
    const half = (slice / 2) * open;
    const a = +(center - half).toFixed(2);
    const b = +(center + half).toFixed(2);
    if (horizontal) pts.push(`0% ${a}%`, `100% ${a}%`, `100% ${b}%`, `0% ${b}%`);
    else pts.push(`${a}% 0%`, `${a}% 100%`, `${b}% 100%`, `${b}% 0%`);
  }
  return `polygon(${pts.join(", ")})`;
}

/**
 * Build the motion triple for the page entering via `id`/`variant`, given the
 * nav `direction`. The same shape is reused as the leaving page's frozen
 * `exit` (Slides decks usually apply one transition to all pages, so the two
 * halves stay consistent).
 */
export function buildPageMotion(
  id: string,
  variant: string,
  dir: TransitionDirection,
): PageMotion {
  const family = FAMILY[id] ?? "fade";
  const v = variant || defaultVariant(id);

  switch (family) {
    case "cut":
      // Instant — no offset; SiteRenderer also shortens the duration for cut.
      return { initial: REST, animate: REST, exit: { ...REST, opacity: 0 } };

    case "fade": {
      // morph adds a touch of scale on top of the cross-fade.
      const scale = id === "morph" ? 1.04 : 1;
      return {
        initial: { ...REST, opacity: 0, scale },
        animate: REST,
        exit: { ...REST, opacity: 0, scale, zIndex: 2 },
      };
    }

    case "flash":
      return {
        initial: { ...REST, opacity: 0, filter: "brightness(4)" },
        animate: { ...REST, filter: "brightness(1)" },
        exit: { ...REST, opacity: 0, filter: "brightness(4)", zIndex: 2 },
      };

    case "push": {
      const o = dirOffset(v, dir);
      return {
        initial: { ...REST, [o.axis]: o.from },
        animate: REST,
        exit: { ...REST, [o.axis]: o.to },
      };
    }

    case "cover": {
      // New slides in on top; old stays put with a slight parallax.
      const o = dirOffset(v, dir);
      return {
        initial: { ...REST, [o.axis]: o.from, zIndex: 2 },
        animate: { ...REST, zIndex: 2 },
        exit: { ...REST, [o.axis]: "-12%", zIndex: 1, opacity: 0.6 },
      };
    }

    case "wipe": {
      // Old clip-wipes away on top; new revealed at rest beneath.
      return {
        initial: REST,
        animate: REST,
        exit: { ...REST, clipPath: wipeExitInset(v, dir), zIndex: 2 },
      };
    }

    case "split": {
      // Curtains "Doors" — the old page parts down the middle to reveal the new
      // beneath. from-top/bottom → a horizontal seam; otherwise a vertical one.
      const horizontalSeam = v === "from-top" || v === "from-bottom";
      const centerLine = horizontalSeam ? "inset(50% 0 50% 0)" : "inset(0 50% 0 50%)";
      return {
        initial: REST,
        animate: REST,
        exit: { ...REST, clipPath: centerLine, zIndex: 2 },
      };
    }

    case "shape": {
      // Curtains "Iris" — the new page grows in from its origin (a circle that
      // expands from a point to full coverage at the chosen corner/centre).
      const IRIS_ORIGIN: Record<string, string> = {
        "top-left": "0% 0%",
        "top-right": "100% 0%",
        "bottom-left": "0% 100%",
        "bottom-right": "100% 100%",
      };
      const origin = IRIS_ORIGIN[v] ?? "50% 50%";
      return {
        initial: { ...REST, clipPath: `circle(0% at ${origin})`, zIndex: 2 },
        animate: { ...REST, clipPath: `circle(150% at ${origin})`, zIndex: 2 },
        exit: { ...REST, zIndex: 1 },
      };
    }

    case "bars": {
      // Leaving page collapses to thin bars on top, revealing the new beneath.
      // Blinds follow the preset ("columns" → vertical slats, else horizontal).
      const horizontal = v !== "columns";
      const full = barsPolygon(5, 1, horizontal);
      const collapsed = barsPolygon(5, 0, horizontal);
      return {
        initial: { ...REST, clipPath: full },
        animate: { ...REST, clipPath: full },
        exit: { ...REST, clipPath: collapsed, zIndex: 2 },
      };
    }

    case "reveal": {
      // Smooth slide + fade of the new page; old fades under it.
      const o = dirOffset(v, dir);
      return {
        initial: {
          ...REST,
          [o.axis]: o.axis === "x" ? (v === "from-left" ? "-30%" : "30%") : "0%",
          opacity: 0,
          zIndex: 2,
        },
        animate: { ...REST, zIndex: 2 },
        exit: { ...REST, opacity: 0, zIndex: 1 },
      };
    }

    case "flip": {
      // 3D flip around Y. `window` reads a touch flatter but shares the family.
      const fromRight = v !== "from-left";
      const sign = (dir === "backward" ? -1 : 1) * (fromRight ? 1 : -1);
      return {
        initial: { ...REST, rotateY: 90 * sign, opacity: 0, transformPerspective: 1400 },
        animate: { ...REST, transformPerspective: 1400 },
        exit: { ...REST, rotateY: -90 * sign, opacity: 0, transformPerspective: 1400, zIndex: 2 },
      };
    }

    case "cube": {
      const o = dirOffset(v, dir);
      const horizontal = o.axis === "x";
      const enterRot = o.from.startsWith("-") ? -90 : 90;
      const axis = horizontal ? "rotateY" : "rotateX";
      return {
        initial: { ...REST, [axis]: enterRot, [o.axis]: o.from, opacity: 0.4, transformPerspective: 1600 },
        animate: { ...REST, transformPerspective: 1600 },
        exit: { ...REST, [axis]: -enterRot, [o.axis]: o.to, opacity: 0.4, zIndex: 2, transformPerspective: 1600 },
      };
    }

    case "gallery": {
      // Perspective slide — new comes from the side rotated, settles flat.
      const fromRight = v !== "from-left";
      const sign = (dir === "backward" ? -1 : 1) * (fromRight ? 1 : -1);
      return {
        initial: { ...REST, x: `${60 * sign}%`, rotateY: -30 * sign, opacity: 0, transformPerspective: 1600 },
        animate: { ...REST, transformPerspective: 1600 },
        exit: { ...REST, x: `${-60 * sign}%`, rotateY: 30 * sign, opacity: 0, transformPerspective: 1600 },
      };
    }

    case "spin": {
      // clock — rotate + scale in.
      const cw = v !== "counterclockwise";
      const sign = cw ? 1 : -1;
      return {
        initial: { ...REST, rotate: 100 * sign, scale: 0.7, opacity: 0 },
        animate: REST,
        exit: { ...REST, rotate: -100 * sign, scale: 0.7, opacity: 0, zIndex: 2 },
      };
    }

    case "shatter": {
      // Preview approximation for the Curtains "Pixels" dissolve — scale + blur
      // + fade. (The live deck runs the real `pixels()` tile dissolve.)
      return {
        initial: { ...REST, scale: 1.15, opacity: 0, filter: "blur(10px) brightness(1)" },
        animate: REST,
        exit: { ...REST, scale: 1.2, opacity: 0, filter: "blur(10px) brightness(1)", zIndex: 2 },
      };
    }

    default:
      return { initial: { ...REST, opacity: 0 }, animate: REST, exit: { ...REST, opacity: 0 } };
  }
}

/** Whether an id has a real animation. Every catalog id now does, so this is
 *  always true except for an unknown id — kept for the panel's safety check. */
export function isImplemented(id: string): boolean {
  return id === "none" || FAMILY[id] != null;
}
