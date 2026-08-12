/**
 * Multiple Choice — the serialize() boundary. Doc JSON → a typed, PM-free
 * payload the completer consumes. This is what keeps the student render
 * decoupled from ProseMirror.
 *
 * NOTE: `correct` ships in this payload today, so the completer can self-check
 * client-side (answers contained to the block). A future graded/published mode
 * would strip it here and grade server-side.
 */

import type { JsonNode } from "../../runtime/shuffleLayout";
import { serializeExplanation } from "../shared/explanation";
import { serializeFeedback, type FeedbackMessages } from "../shared/scoring";
import type { ScoringMode } from "../types";
import { MC_OPTION_NODE, MC_PROMPT_NODE } from "./schema";

export interface McOption {
  optionId: string;
  /** Rich inline content of the option (rendered via `renderInline`). */
  content: JsonNode[];
  correct: boolean;
  /** Optional image URL — backs the card in the "grid" layout. */
  image: string;
}

export interface MultipleChoiceDef {
  itemId: string;
  multiple: boolean;
  /** Point value of the question (for scoring). */
  points: number;
  /** How the question earns its points — see {@link ScoringMode}. "completion"
   *  means any selection earns full credit (an opinion poll). */
  scoringMode: ScoringMode;
  /** Option layout — "list" (default) or "grid" (image cards). */
  layout: "list" | "grid";
  /** Author-customizable verdict messages. */
  feedback: FeedbackMessages;
  /** The "here's why" rationale (rich inline), shown in the feedback block. */
  explanation: JsonNode[];
  /** The question stem's content BLOCKS (paragraph/image/audio/…), rendered by
   *  the shared block walker in the completer. */
  prompt: JsonNode[];
  options: McOption[];
}

export function serializeMultipleChoice(node: JsonNode): MultipleChoiceDef {
  const a = node.attrs ?? {};
  const children = node.content ?? [];
  const prompt = children.find((c) => c.type === MC_PROMPT_NODE)?.content ?? [];
  const options = children
    .filter((c) => c.type === MC_OPTION_NODE)
    .map((o) => ({
      optionId: (o.attrs?.["optionId"] as string) || "",
      content: o.content ?? [],
      correct: !!o.attrs?.["correct"],
      image: (o.attrs?.["image"] as string) || "",
    }));
  return {
    itemId: (a["itemId"] as string) || "",
    multiple: !!a["multiple"],
    points: typeof a["points"] === "number" ? (a["points"] as number) : 1,
    scoringMode: a["scoringMode"] === "completion" ? "completion" : "correctness",
    layout: a["layout"] === "grid" ? "grid" : "list",
    feedback: serializeFeedback(a),
    explanation: serializeExplanation(node),
    prompt,
    options,
  };
}
