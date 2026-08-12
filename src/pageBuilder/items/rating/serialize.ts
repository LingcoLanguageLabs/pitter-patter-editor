/**
 * Rating — serialize() boundary. Doc JSON → a typed, PM-free payload the
 * completer consumes. A rating is always a "completion" (survey) item.
 */

import type { JsonNode } from "../../runtime/shuffleLayout";
import { serializeExplanation } from "../shared/explanation";
import { serializeFeedback, type FeedbackMessages } from "../shared/scoring";
import { RATING_PROMPT_NODE, type RatingIconStyle } from "./schema";

export interface RatingDef {
  itemId: string;
  points: number;
  /** Number of icons on the scale. */
  scale: number;
  icon: RatingIconStyle;
  lowLabel: string;
  highLabel: string;
  /** Author-customizable verdict message (completion only). */
  feedback: FeedbackMessages;
  /** The "here's why" rationale (rich inline), shown in the feedback block. */
  explanation: JsonNode[];
  /** The question stem's content BLOCKS, rendered by the shared block walker. */
  prompt: JsonNode[];
}

export function serializeRating(node: JsonNode): RatingDef {
  const a = node.attrs ?? {};
  const prompt =
    (node.content ?? []).find((c) => c.type === RATING_PROMPT_NODE)?.content ??
    [];
  const scale = typeof a["scale"] === "number" ? (a["scale"] as number) : 5;
  return {
    itemId: (a["itemId"] as string) || "",
    points: typeof a["points"] === "number" ? (a["points"] as number) : 1,
    scale: Math.max(2, scale),
    icon: (a["icon"] as RatingIconStyle) || "star",
    lowLabel: (a["lowLabel"] as string) || "",
    highLabel: (a["highLabel"] as string) || "",
    feedback: serializeFeedback(a),
    explanation: serializeExplanation(node),
    prompt,
  };
}
