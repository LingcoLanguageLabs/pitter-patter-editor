/**
 * Text Prompt — node factories. `buildTextPrompt` makes a populated block (used
 * by demo docs); `constructTextPrompt` is the catalog default inserted from the
 * "+ Add block" picker. Both stamp a stable id.
 */

import type { Node as PmNode, Schema } from "prosemirror-model";

import { newId } from "../shared/ids";
import {
  TEXT_PROMPT_NODE,
  TEXT_PROMPT_STEM_NODE,
  type TextPromptVariant,
} from "./schema";

export function buildTextPrompt(
  schema: Schema,
  prompt: string,
  attrs?: { variant?: TextPromptVariant; placeholder?: string },
): PmNode {
  const item = schema.nodes[TEXT_PROMPT_NODE];
  const stemType = schema.nodes[TEXT_PROMPT_STEM_NODE];
  const paragraphType = schema.nodes["paragraph"];
  if (!item || !stemType || !paragraphType) {
    throw new Error("Text-prompt schema not installed. Is the item registered?");
  }
  // The stem is a block container; default it to a single paragraph holding the
  // question text. schema.text() rejects empty strings, so pass no content for
  // an empty prompt (an empty paragraph is still a valid `block+`).
  const stem = stemType.create(
    null,
    paragraphType.create(null, prompt ? schema.text(prompt) : undefined),
  );
  return item.create(
    {
      itemId: newId("txt"),
      variant: attrs?.variant ?? "short",
      placeholder: attrs?.placeholder ?? "",
    },
    stem,
  );
}

export function constructTextPrompt(schema: Schema): PmNode {
  return buildTextPrompt(schema, "Question");
}
