/**
 * Categorization — node factories. `buildCategorization` makes a populated
 * block (used by demo docs); `constructCategorization` is the catalog default
 * inserted from the "+ Add block" picker. Both stamp stable ids and encode the
 * answer key by nesting each item inside its correct category bucket.
 */

import type { Node as PmNode, Schema } from "prosemirror-model";

import { buildItemExplanation } from "../shared/explanation";
import { newId } from "../shared/ids";
import {
  CAT_CATEGORY_NODE,
  CAT_ITEM_NODE,
  CAT_NODE,
  CAT_PROMPT_NODE,
  type CatDisplay,
} from "./schema";

export interface CatCategorySeed {
  name: string;
  /** Item card texts that belong in this category (the answer key). */
  items: string[];
}

export function buildCategorization(
  schema: Schema,
  prompt: string,
  categories: ReadonlyArray<CatCategorySeed>,
  attrs?: { display?: CatDisplay },
): PmNode {
  const cat = schema.nodes[CAT_NODE];
  const promptType = schema.nodes[CAT_PROMPT_NODE];
  const categoryType = schema.nodes[CAT_CATEGORY_NODE];
  const itemType = schema.nodes[CAT_ITEM_NODE];
  const paragraphType = schema.nodes["paragraph"];
  if (!cat || !promptType || !categoryType || !itemType || !paragraphType) {
    throw new Error(
      "Categorization schema not installed. Is the item registered?",
    );
  }
  // The stem is a block container; default it to a single paragraph holding the
  // question text. schema.text() rejects empty strings, so pass no content for
  // an empty prompt (an empty paragraph is still a valid `block+`).
  const promptNode = promptType.create(
    null,
    paragraphType.create(null, prompt ? schema.text(prompt) : undefined),
  );
  const categoryNodes = categories.map((c) =>
    categoryType.create(
      { categoryId: newId("cat"), name: c.name },
      c.items.map((text) =>
        itemType.create(
          { cardId: newId("card") },
          text ? schema.text(text) : undefined,
        ),
      ),
    ),
  );
  return cat.create(
    { itemId: newId("catq"), display: attrs?.display ?? "grid" },
    [promptNode, ...categoryNodes, buildItemExplanation(schema)],
  );
}

export function constructCategorization(schema: Schema): PmNode {
  return buildCategorization(schema, "Sort the items into the right group", [
    { name: "Group A", items: ["Item 1", "Item 2"] },
    { name: "Group B", items: ["Item 3"] },
  ]);
}
