/**
 * Audio Prompt — the serialize() boundary. Doc JSON → a typed, PM-free payload
 * the completer consumes, keeping the student render decoupled from ProseMirror.
 */

import type { JsonNode } from "../../runtime/shuffleLayout";
import { AUDIO_PROMPT_STEM_NODE } from "./schema";

export interface AudioPromptDef {
  itemId: string;
  /** Allowed recording attempts (≥ 1). */
  attempts: number;
  /** Whether the student can play their recording back. */
  allowPlayback: boolean;
  /** Whether the student can upload an audio file instead of recording. */
  allowUpload: boolean;
  /** The question stem's content BLOCKS (paragraph/image/audio/…), rendered by
   *  the shared block walker in the completer. */
  prompt: JsonNode[];
}

export function serializeAudioPrompt(node: JsonNode): AudioPromptDef {
  const a = node.attrs ?? {};
  const children = node.content ?? [];
  const prompt =
    children.find((c) => c.type === AUDIO_PROMPT_STEM_NODE)?.content ?? [];
  const attempts = typeof a["attempts"] === "number" ? (a["attempts"] as number) : 1;
  return {
    itemId: (a["itemId"] as string) || "",
    attempts: Math.max(1, attempts),
    allowPlayback: a["allowPlayback"] !== false,
    allowUpload: !!a["allowUpload"],
    prompt,
  };
}
