/**
 * Labeled image — schema. A CONTENT item (not graded): the author marks an image
 * with point markers, each carrying a title + description, and the student taps
 * a marker (or its chip) to read about it. The exploratory cousin of Hotspot —
 * Hotspot grades clicking the *correct* regions; this one just reveals content,
 * so there's no answer key, points, or feedback.
 *
 *   labeled_image          — outer block (group "block"): gets shuffle grid /
 *                            margin / section-containment for free.
 *     labeled_image_prompt — the intro STEM (exactly one): a `block+` "put
 *                            anything" container (the same stem Hotspot/MC use).
 *
 * The image (`src`/`alt`), the `eyebrow` label, and the `markers` (geometry +
 * content) are ATTRS — markers are normalized geometry drawn on the image, not
 * editable child nodes. `markers` round-trips as JSON.
 */

import type { NodeSpec } from "prosemirror-model";

import { coerceMarkers, type LabeledMarker } from "./markers";

export const LABELED_IMAGE_NODE = "labeled_image";
export const LABELED_IMAGE_PROMPT_NODE = "labeled_image_prompt";

export const labeledImageSpec: NodeSpec = {
  group: "block",
  content: LABELED_IMAGE_PROMPT_NODE,
  defining: true,
  isolating: true,
  attrs: {
    /** Stable id (parity with other items; not used for grading here). */
    itemId: { default: "" },
    /** Backdrop image the author marks up. */
    src: { default: "" },
    alt: { default: "" },
    /** Small label above the info panel (e.g. "Tap a marker"). */
    eyebrow: { default: "Tap a marker" },
    /** Markers: point coords (normalized) + label/body content. */
    markers: { default: [] as LabeledMarker[] },
  },
  parseDOM: [
    {
      tag: 'div[data-node-type="labeled-image"]',
      getAttrs(dom) {
        if (!(dom instanceof HTMLElement)) return false;
        let markers: LabeledMarker[] = [];
        try {
          markers = coerceMarkers(JSON.parse(dom.getAttribute("data-markers") || "[]"));
        } catch {
          markers = [];
        }
        return {
          itemId: dom.getAttribute("data-item-id") || "",
          src: dom.getAttribute("data-src") || "",
          alt: dom.getAttribute("data-alt") || "",
          eyebrow: dom.getAttribute("data-eyebrow") || "Tap a marker",
          markers,
        };
      },
    },
  ],
  toDOM(node) {
    const a = node.attrs;
    const markers = (a["markers"] as LabeledMarker[]) ?? [];
    const attrs: Record<string, string> = {
      "data-node-type": "labeled-image",
      class: "pp-labeled",
    };
    if (a["itemId"]) attrs["data-item-id"] = a["itemId"] as string;
    if (a["src"]) attrs["data-src"] = a["src"] as string;
    if (a["alt"]) attrs["data-alt"] = a["alt"] as string;
    if (a["eyebrow"]) attrs["data-eyebrow"] = a["eyebrow"] as string;
    if (markers.length) attrs["data-markers"] = JSON.stringify(markers);
    return ["div", attrs, 0];
  },
};

export const labeledImagePromptSpec: NodeSpec = {
  content: "block+",
  defining: true,
  parseDOM: [{ tag: 'div[data-node-type="labeled-image-prompt"]' }],
  toDOM: () => [
    "div",
    { "data-node-type": "labeled-image-prompt", class: "pp-labeled-prompt" },
    0,
  ],
};
