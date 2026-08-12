/**
 * Hotspot — schema. An assessment item: the author marks an image with regions
 * (rectangles / points), some correct, and the student clicks the ones they
 * think are right (the image cousin of Mark Tokens). Graded by correctness.
 *
 *   hotspot          — outer block (group "block"): the question. Gets shuffle
 *                      grid attrs / margin / section-containment for free.
 *     hotspot_prompt — the instruction STEM (exactly one): a `block+` "put
 *                      anything" container (paragraph by default, plus media),
 *                      the SAME stem MC/Rating use.
 *
 * The image (`src`/`alt`) and the answer-key `regions` are ATTRS on `hotspot`,
 * not child nodes — regions are normalized GEOMETRY (drawn on the image), not
 * editable content. The builder node view renders the drawable image; the
 * completer renders the clickable regions. `regions` round-trips as JSON.
 */

import type { NodeSpec } from "prosemirror-model";

import {
  FEEDBACK_NODE_ATTRS,
  feedbackToDom,
  readFeedbackAttrs,
} from "../shared/scoring";
import { coerceRegions, type HotspotRegion } from "./regions";

export const HOTSPOT_NODE = "hotspot";
export const HOTSPOT_PROMPT_NODE = "hotspot_prompt";

export const hotspotSpec: NodeSpec = {
  group: "block",
  content: `${HOTSPOT_PROMPT_NODE} item_explanation`,
  defining: true,
  isolating: true,
  attrs: {
    /** Stable id for response keying / persistence. Stamped on construct. */
    itemId: { default: "" },
    /** Point value (graded by correctness — selected regions must match the key). */
    points: { default: 1 },
    /** How the student answers: "select" (regions are shown; tap the correct
     *  ones) or "find" (regions hidden; click the image to locate the targets). */
    mode: { default: "select" as "select" | "find" },
    /** Backdrop image the author marks up. */
    src: { default: "" },
    alt: { default: "" },
    /** Answer-key regions (rect/point, normalized coords + `correct`). */
    regions: { default: [] as HotspotRegion[] },
    // Author-customizable verdict messages (shared across gradable types).
    ...FEEDBACK_NODE_ATTRS,
  },
  parseDOM: [
    {
      tag: 'div[data-node-type="hotspot"]',
      getAttrs(dom) {
        if (!(dom instanceof HTMLElement)) return false;
        const points = dom.getAttribute("data-points");
        let regions: HotspotRegion[] = [];
        try {
          regions = coerceRegions(JSON.parse(dom.getAttribute("data-regions") || "[]"));
        } catch {
          regions = [];
        }
        return {
          itemId: dom.getAttribute("data-item-id") || "",
          points: points == null ? 1 : Number(points),
          mode: dom.getAttribute("data-mode") === "find" ? "find" : "select",
          src: dom.getAttribute("data-src") || "",
          alt: dom.getAttribute("data-alt") || "",
          regions,
          ...readFeedbackAttrs(dom),
        };
      },
    },
  ],
  toDOM(node) {
    const a = node.attrs;
    const regions = (a["regions"] as HotspotRegion[]) ?? [];
    const attrs: Record<string, string> = {
      "data-node-type": "hotspot",
      class: "pp-hotspot",
      ...feedbackToDom(a),
    };
    if (a["itemId"]) attrs["data-item-id"] = a["itemId"] as string;
    if (a["points"] !== 1) attrs["data-points"] = String(a["points"]);
    if (a["mode"] === "find") attrs["data-mode"] = "find";
    if (a["src"]) attrs["data-src"] = a["src"] as string;
    if (a["alt"]) attrs["data-alt"] = a["alt"] as string;
    if (regions.length) attrs["data-regions"] = JSON.stringify(regions);
    return ["div", attrs, 0];
  },
};

export const hotspotPromptSpec: NodeSpec = {
  content: "block+",
  defining: true,
  parseDOM: [{ tag: 'div[data-node-type="hotspot-prompt"]' }],
  toDOM: () => [
    "div",
    { "data-node-type": "hotspot-prompt", class: "pp-hotspot-prompt" },
    0,
  ],
};
