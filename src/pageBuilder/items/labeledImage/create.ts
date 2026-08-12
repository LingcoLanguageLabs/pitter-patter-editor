/**
 * Labeled image — node factories. `buildLabeledImage` makes a populated block
 * (demo docs); `constructLabeledImage` is the catalog default (empty image +
 * intro, the author sets the image and drops markers). Both stamp a stable id.
 */

import type { Node as PmNode, Schema } from "prosemirror-model";

import { newId } from "../shared/ids";
import type { LabeledMarker } from "./markers";
import { LABELED_IMAGE_NODE, LABELED_IMAGE_PROMPT_NODE } from "./schema";

export function buildLabeledImage(
  schema: Schema,
  prompt: string,
  attrs?: { src?: string; alt?: string; eyebrow?: string; markers?: LabeledMarker[] },
): PmNode {
  const node = schema.nodes[LABELED_IMAGE_NODE];
  const promptType = schema.nodes[LABELED_IMAGE_PROMPT_NODE];
  const paragraphType = schema.nodes["paragraph"];
  if (!node || !promptType || !paragraphType) {
    throw new Error("Labeled-image schema not installed. Is the item registered?");
  }
  const promptNode = promptType.create(
    null,
    paragraphType.create(null, prompt ? schema.text(prompt) : undefined),
  );
  return node.create(
    {
      itemId: newId("labeled"),
      src: attrs?.src ?? "",
      alt: attrs?.alt ?? "",
      eyebrow: attrs?.eyebrow ?? "Tap a marker",
      markers: attrs?.markers ?? [],
    },
    [promptNode],
  );
}

export function constructLabeledImage(schema: Schema): PmNode {
  return buildLabeledImage(schema, "Explore the markers on the image.");
}
