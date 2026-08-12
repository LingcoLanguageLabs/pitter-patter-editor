/**
 * Categorization — the serialize() boundary. Doc JSON → a typed, PM-free
 * payload the completer consumes. The nesting (item inside a category bucket)
 * becomes a flat item list where each item carries its `correctCategoryId`.
 *
 * NOTE: the answer key ships in this payload so the completer can self-check
 * client-side (answers contained to the block). A future graded/published mode
 * would strip `correctCategoryId` here and grade server-side.
 */

import type { JsonNode } from "../../runtime/shuffleLayout";
import { serializeExplanation } from "../shared/explanation";
import { serializeFeedback, type FeedbackMessages } from "../shared/scoring";
import {
  CAT_CATEGORY_NODE,
  CAT_ITEM_NODE,
  CAT_PROMPT_NODE,
  type CatDisplay,
} from "./schema";

export interface CatCategory {
  id: string;
  name: string;
}

export interface CatCard {
  id: string;
  /** Rich inline content of the card (rendered via `renderInline`). */
  content: JsonNode[];
  /** The bucket this card belongs in — the answer key. */
  correctCategoryId: string;
}

export interface CategorizationDef {
  itemId: string;
  points: number;
  feedback: FeedbackMessages;
  /** The "here's why" rationale (rich inline), shown in the feedback block. */
  explanation: JsonNode[];
  display: CatDisplay;
  /** Question stem content BLOCKS, rendered by the shared block walker. */
  prompt: JsonNode[];
  categories: CatCategory[];
  items: CatCard[];
}

export function serializeCategorization(node: JsonNode): CategorizationDef {
  const a = node.attrs ?? {};
  const children = node.content ?? [];
  const prompt =
    children.find((c) => c.type === CAT_PROMPT_NODE)?.content ?? [];

  const categories: CatCategory[] = [];
  const items: CatCard[] = [];
  for (const child of children) {
    if (child.type !== CAT_CATEGORY_NODE) continue;
    const categoryId = (child.attrs?.["categoryId"] as string) || "";
    categories.push({
      id: categoryId,
      name: (child.attrs?.["name"] as string) || "",
    });
    for (const card of child.content ?? []) {
      if (card.type !== CAT_ITEM_NODE) continue;
      items.push({
        id: (card.attrs?.["cardId"] as string) || "",
        content: card.content ?? [],
        correctCategoryId: categoryId,
      });
    }
  }

  return {
    itemId: (a["itemId"] as string) || "",
    points: typeof a["points"] === "number" ? (a["points"] as number) : 1,
    feedback: serializeFeedback(a),
    explanation: serializeExplanation(node),
    display: a["display"] === "matrix" ? "matrix" : "grid",
    prompt,
    categories,
    items,
  };
}
