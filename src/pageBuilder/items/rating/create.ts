/**
 * Rating — node factories. `buildRating` makes a populated block (demo docs);
 * `constructRating` is the catalog default inserted from the "+ Add block"
 * picker. Both stamp a stable `itemId`.
 */

import type { Node as PmNode, Schema } from "prosemirror-model";

import { buildItemExplanation } from "../shared/explanation";
import { newId } from "../shared/ids";
import {
  RATING_NODE,
  RATING_PROMPT_NODE,
  type RatingIconStyle,
} from "./schema";

export function buildRating(
  schema: Schema,
  prompt: string,
  attrs?: {
    scale?: number;
    icon?: RatingIconStyle;
    lowLabel?: string;
    highLabel?: string;
  },
): PmNode {
  const rating = schema.nodes[RATING_NODE];
  const promptType = schema.nodes[RATING_PROMPT_NODE];
  const paragraphType = schema.nodes["paragraph"];
  if (!rating || !promptType || !paragraphType) {
    throw new Error("Rating schema not installed. Is the item registered?");
  }
  const promptNode = promptType.create(
    null,
    paragraphType.create(null, prompt ? schema.text(prompt) : undefined),
  );
  return rating.create(
    {
      itemId: newId("rating"),
      scale: attrs?.scale ?? 5,
      icon: attrs?.icon ?? "star",
      lowLabel: attrs?.lowLabel ?? "",
      highLabel: attrs?.highLabel ?? "",
    },
    [promptNode, buildItemExplanation(schema)],
  );
}

/** Catalog default. `attrs` carries the chosen picker preset's attrs (icon
 *  style, etc.) so a future "Hearts"/"Emoji" preset can seed a different look. */
export function constructRating(
  schema: Schema,
  attrs?: Record<string, unknown>,
): PmNode {
  return buildRating(schema, "How would you rate this?", {
    icon: (attrs?.["icon"] as RatingIconStyle) ?? "star",
    scale: typeof attrs?.["scale"] === "number" ? (attrs["scale"] as number) : 5,
  });
}
