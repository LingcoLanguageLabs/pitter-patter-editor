/**
 * Bridges the deck's "Curtains" gallery group to the real Motion+ curtains
 * library (`motion-plus-dom/curtains`). We import and call the package — its
 * `curtains(callback, { effect, transition, scope })` covers a scoped element,
 * runs a DOM-swap callback while occluded, then reveals — so `SiteRenderer`
 * commits the React page change inside the callback (via `flushSync`).
 *
 * This maps each `curtains-*` catalog id + its Effect Option preset onto the
 * matching factory (`fade`, `wipe`, `clipWipe`, `doors`, `iris`, `blinds`,
 * `shutter`, `staggerWipe`, `pixels`). The presets in `transitions.ts` are the
 * "logical" subset of each factory's real options — directional effects take a
 * travel `direction`, iris an `origin`, blinds a slat `direction`, pixels a
 * fill `order` — and the helpers below translate a preset id to that value.
 * The PowerPoint groups keep using the Framer Motion implementations in
 * `transitions.ts`; only this group routes through Motion+.
 */

import {
  type CurtainEffect,
  blinds,
  clipWipe,
  doors,
  fade,
  iris,
  pixels,
  shutter,
  staggerWipe,
  wipe,
} from "motion-plus-dom/curtains";

type Direction = "up" | "down" | "left" | "right";
type TileOrder = "rows" | "columns" | "diagonal" | "radial" | "random";

/** A configured effect to hand to `curtains({ effect })`. A `[in, out]` tuple
 *  plays a different effect for the reveal than the cover (the "Mixed" preset);
 *  the library's `effect` option accepts both forms. */
type ConfiguredEffect = CurtainEffect | [CurtainEffect, CurtainEffect];

/** Whether an id is a Motion+ Curtains effect (vs a Framer Motion one). */
export function isCurtainsId(id: string): boolean {
  return id.startsWith("curtains-");
}

/** Map a directional preset ("from-right", …) to the curtain's travel
 *  `Direction` — "From Right" means the incoming edge enters from the right and
 *  sweeps left, etc. */
function directionFor(variant: string): Direction {
  switch (variant) {
    case "from-left":
      return "right";
    case "from-right":
      return "left";
    case "from-top":
      return "down";
    case "from-bottom":
      return "up";
    default:
      return "left";
  }
}

/** Map an iris origin preset to a 0–1 box fraction (the library's `origin`). */
function originFor(variant: string): { x: number; y: number } {
  switch (variant) {
    case "top-left":
      return { x: 0, y: 0 };
    case "top-right":
      return { x: 1, y: 0 };
    case "bottom-left":
      return { x: 0, y: 1 };
    case "bottom-right":
      return { x: 1, y: 1 };
    case "center":
    default:
      return { x: 0.5, y: 0.5 };
  }
}

/** Map a pixels fill-order preset to the library's `TileOrder`. */
function orderFor(variant: string): TileOrder {
  switch (variant) {
    case "rows":
    case "columns":
    case "diagonal":
    case "radial":
    case "random":
      return variant;
    default:
      return "random";
  }
}

/** Build the configured Motion+ `CurtainEffect` for a `curtains-*` id. */
export function curtainEffectFor(id: string, variant: string): ConfiguredEffect {
  switch (id) {
    case "curtains-fade":
      return fade();
    case "curtains-wipe":
      return wipe({ direction: directionFor(variant) });
    case "curtains-clip-wipe":
      return clipWipe({ direction: directionFor(variant), bow: 0.16 });
    case "curtains-doors":
      return doors({ direction: directionFor(variant) });
    case "curtains-iris":
      return iris({ origin: originFor(variant) });
    case "curtains-blinds":
      return blinds({ direction: variant === "columns" ? "column" : "row" });
    case "curtains-shutter":
      return shutter();
    case "curtains-stagger":
      return staggerWipe({ direction: directionFor(variant) });
    case "curtains-pixels":
      return pixels({ order: orderFor(variant) });
    case "curtains-mixed":
      // The library's signature "[in, out]" demo: cover with a clip-wipe, then
      // reveal with an iris — a visibly different effect on the way out.
      return [
        clipWipe({ direction: "left", bow: 0.16 }),
        iris({ origin: { x: 0.5, y: 0.5 } }),
      ];
    default:
      return fade();
  }
}
