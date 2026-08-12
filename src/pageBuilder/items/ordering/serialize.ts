/**
 * Ordering — the serialize() boundary. Doc JSON → a typed, PM-free payload the
 * completer consumes. The item cards are emitted in document order, which IS the
 * correct sequence (the answer key).
 *
 * NOTE: the key (the correct order) ships in this payload so the completer can
 * self-check client-side (answers contained to the block). A future graded mode
 * would withhold it and grade server-side.
 */

import type { JsonNode } from "../../runtime/shuffleLayout";
import { serializeExplanation } from "../shared/explanation";
import { serializeFeedback, type FeedbackMessages } from "../shared/scoring";
import { ORD_ITEM_NODE, ORD_PROMPT_NODE } from "./schema";

export interface OrdCard {
  id: string;
  /** Rich inline content of the card (rendered via `renderInline`). */
  content: JsonNode[];
}

export interface OrderingDef {
  itemId: string;
  points: number;
  feedback: FeedbackMessages;
  /** The "here's why" rationale (rich inline), shown in the feedback block. */
  explanation: JsonNode[];
  /** Question stem content BLOCKS, rendered by the shared block walker. */
  prompt: JsonNode[];
  /** Item cards in their CORRECT order — the array index is the answer key. */
  items: OrdCard[];
}

export function serializeOrdering(node: JsonNode): OrderingDef {
  const a = node.attrs ?? {};
  const children = node.content ?? [];
  const prompt =
    children.find((c) => c.type === ORD_PROMPT_NODE)?.content ?? [];
  const items: OrdCard[] = children
    .filter((c) => c.type === ORD_ITEM_NODE)
    .map((c) => ({
      id: (c.attrs?.["cardId"] as string) || "",
      content: c.content ?? [],
    }));
  return {
    itemId: (a["itemId"] as string) || "",
    points: typeof a["points"] === "number" ? (a["points"] as number) : 1,
    feedback: serializeFeedback(a),
    explanation: serializeExplanation(node),
    prompt,
    items,
  };
}
