/**
 * Multiple Choice — node factories. `buildMultipleChoice` makes a populated
 * block (used by demo docs); `constructMultipleChoice` is the catalog default
 * inserted from the "+ Add block" picker. Both stamp stable ids.
 */

import type { Node as PmNode, Schema } from "prosemirror-model";

import { buildItemExplanation } from "../shared/explanation";
import { newId } from "../shared/ids";
import type { ScoringMode } from "../types";
import { MC_NODE, MC_OPTION_NODE, MC_PROMPT_NODE } from "./schema";

export interface McOptionSeed {
  text: string;
  correct?: boolean;
  /** Optional image URL — backs the option's card in the "grid" layout. */
  image?: string;
}

export function buildMultipleChoice(
  schema: Schema,
  prompt: string,
  options: ReadonlyArray<McOptionSeed>,
  attrs?: { multiple?: boolean; scoringMode?: ScoringMode; layout?: "list" | "grid" },
): PmNode {
  const mc = schema.nodes[MC_NODE];
  const promptType = schema.nodes[MC_PROMPT_NODE];
  const optionType = schema.nodes[MC_OPTION_NODE];
  const paragraphType = schema.nodes["paragraph"];
  if (!mc || !promptType || !optionType || !paragraphType) {
    throw new Error(
      "Multiple-choice schema not installed. Is the item registered?",
    );
  }
  // The stem is a block container; default it to a single paragraph holding the
  // question text. schema.text() rejects empty strings, so pass no content for
  // an empty prompt (an empty paragraph is still a valid `block+`).
  const promptNode = promptType.create(
    null,
    paragraphType.create(null, prompt ? schema.text(prompt) : undefined),
  );
  const optionNodes = options.map((o) =>
    optionType.create(
      { optionId: newId("opt"), correct: !!o.correct, image: o.image ?? "" },
      o.text ? schema.text(o.text) : undefined,
    ),
  );
  return mc.create(
    {
      itemId: newId("mc"),
      multiple: !!attrs?.multiple,
      scoringMode: attrs?.scoringMode ?? "correctness",
      layout: attrs?.layout ?? "list",
    },
    [promptNode, ...optionNodes, buildItemExplanation(schema)],
  );
}

/** Catalog default. `attrs` carries the chosen picker preset (e.g. the opinion
 *  poll's `scoringMode: "completion"` + `multiple: true`). A completion poll
 *  seeds neutral choices (no option is "correct"); a correctness MC is the
 *  plain default. */
export function constructMultipleChoice(
  schema: Schema,
  attrs?: Record<string, unknown>,
): PmNode {
  const scoringMode: ScoringMode =
    attrs?.["scoringMode"] === "completion" ? "completion" : "correctness";
  const multiple =
    typeof attrs?.["multiple"] === "boolean"
      ? (attrs["multiple"] as boolean)
      : scoringMode === "completion"; // a poll defaults to multi-select
  return buildMultipleChoice(
    schema,
    scoringMode === "completion" ? "Which of these do you like?" : "Question",
    [{ text: "Option 1" }, { text: "Option 2" }, { text: "Option 3" }],
    { multiple, scoringMode },
  );
}
