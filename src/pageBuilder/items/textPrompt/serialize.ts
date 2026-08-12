/**
 * Text Prompt — the serialize() boundary. Doc JSON → a typed, PM-free payload
 * the completer consumes, keeping the student render decoupled from ProseMirror.
 */

import type { JsonNode } from "../../runtime/shuffleLayout";
import {
  TEXT_PROMPT_STEM_NODE,
  type TextPromptVariant,
  type TextPromptWidth,
} from "./schema";

export interface TextPromptDef {
  itemId: string;
  variant: TextPromptVariant;
  /** Short-input width ("fill" | "fit"); ignored by the long textarea. */
  fieldWidth: TextPromptWidth;
  /** Custom placeholder ("" = the completer's built-in default). */
  placeholder: string;
  /** The question stem's content BLOCKS (paragraph/image/audio/…), rendered by
   *  the shared block walker in the completer. */
  prompt: JsonNode[];
}

export function serializeTextPrompt(node: JsonNode): TextPromptDef {
  const a = node.attrs ?? {};
  const children = node.content ?? [];
  const prompt =
    children.find((c) => c.type === TEXT_PROMPT_STEM_NODE)?.content ?? [];
  return {
    itemId: (a["itemId"] as string) || "",
    variant: a["variant"] === "long" ? "long" : "short",
    fieldWidth: a["fieldWidth"] === "compact" ? "compact" : "fill",
    placeholder: (a["placeholder"] as string) || "",
    prompt,
  };
}
