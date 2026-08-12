/**
 * Labeled image — serialize() boundary. Doc JSON → a typed, PM-free payload the
 * completer consumes. No grading fields (this item carries no credit).
 */

import type { JsonNode } from "../../runtime/shuffleLayout";
import { coerceMarkers, type LabeledMarker } from "./markers";
import { LABELED_IMAGE_PROMPT_NODE } from "./schema";

export interface LabeledImageDef {
  itemId: string;
  src: string;
  alt: string;
  eyebrow: string;
  markers: LabeledMarker[];
  /** The intro stem's content BLOCKS, rendered by the shared block walker. */
  prompt: JsonNode[];
}

export function serializeLabeledImage(node: JsonNode): LabeledImageDef {
  const a = node.attrs ?? {};
  const prompt =
    (node.content ?? []).find((c) => c.type === LABELED_IMAGE_PROMPT_NODE)
      ?.content ?? [];
  return {
    itemId: (a["itemId"] as string) || "",
    src: (a["src"] as string) || "",
    alt: (a["alt"] as string) || "",
    eyebrow: (a["eyebrow"] as string) || "Tap a marker",
    markers: coerceMarkers(a["markers"]),
    prompt,
  };
}
