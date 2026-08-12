/**
 * Ordering — node factories. `buildOrdering` makes a populated block (used by
 * demo docs); `constructOrdering` is the catalog default inserted from the "+
 * Add block" picker. Both stamp stable ids. The items are written in their
 * CORRECT order — that document order is the answer key.
 */

import type { Node as PmNode, Schema } from "prosemirror-model";

import { buildItemExplanation } from "../shared/explanation";
import { newId } from "../shared/ids";
import {
  ORD_ITEM_NODE,
  ORD_NODE,
  ORD_PROMPT_NODE,
} from "./schema";

export function buildOrdering(
  schema: Schema,
  prompt: string,
  /** Item texts IN THEIR CORRECT ORDER (the answer key). */
  items: ReadonlyArray<string>,
): PmNode {
  const ord = schema.nodes[ORD_NODE];
  const promptType = schema.nodes[ORD_PROMPT_NODE];
  const itemType = schema.nodes[ORD_ITEM_NODE];
  const paragraphType = schema.nodes["paragraph"];
  if (!ord || !promptType || !itemType || !paragraphType) {
    throw new Error("Ordering schema not installed. Is the item registered?");
  }
  // The stem is a block container; default it to a single paragraph holding the
  // question text. schema.text() rejects empty strings, so pass no content for
  // an empty prompt (an empty paragraph is still a valid `block+`).
  const promptNode = promptType.create(
    null,
    paragraphType.create(null, prompt ? schema.text(prompt) : undefined),
  );
  const itemNodes = items.map((text) =>
    itemType.create(
      { cardId: newId("card") },
      text ? schema.text(text) : undefined,
    ),
  );
  return ord.create({ itemId: newId("ordq") }, [
    promptNode,
    ...itemNodes,
    buildItemExplanation(schema),
  ]);
}

export function constructOrdering(schema: Schema): PmNode {
  return buildOrdering(schema, "Put these in the correct order", [
    "First",
    "Second",
    "Third",
  ]);
}
