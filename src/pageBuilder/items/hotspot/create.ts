/**
 * Hotspot — node factories. `buildHotspot` makes a populated block (demo docs);
 * `constructHotspot` is the catalog default (empty image + instruction, the
 * author sets the image and draws regions). Both stamp a stable `itemId`.
 */

import type { Node as PmNode, Schema } from "prosemirror-model";

import { buildItemExplanation } from "../shared/explanation";
import { newId } from "../shared/ids";
import type { HotspotRegion } from "./regions";
import { HOTSPOT_NODE, HOTSPOT_PROMPT_NODE } from "./schema";

export function buildHotspot(
  schema: Schema,
  prompt: string,
  attrs?: { src?: string; alt?: string; regions?: HotspotRegion[] },
): PmNode {
  const hotspot = schema.nodes[HOTSPOT_NODE];
  const promptType = schema.nodes[HOTSPOT_PROMPT_NODE];
  const paragraphType = schema.nodes["paragraph"];
  if (!hotspot || !promptType || !paragraphType) {
    throw new Error("Hotspot schema not installed. Is the item registered?");
  }
  const promptNode = promptType.create(
    null,
    paragraphType.create(null, prompt ? schema.text(prompt) : undefined),
  );
  return hotspot.create(
    {
      itemId: newId("hotspot"),
      src: attrs?.src ?? "",
      alt: attrs?.alt ?? "",
      regions: attrs?.regions ?? [],
    },
    [promptNode, buildItemExplanation(schema)],
  );
}

export function constructHotspot(schema: Schema): PmNode {
  return buildHotspot(schema, "Click the correct area in the image.");
}
