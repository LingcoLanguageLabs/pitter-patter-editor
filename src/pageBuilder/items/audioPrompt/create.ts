/**
 * Audio Prompt — node factories. `buildAudioPrompt` makes a populated block
 * (used by demo docs); `constructAudioPrompt` is the catalog default inserted
 * from the "+ Add block" picker. Both stamp a stable id.
 */

import type { Node as PmNode, Schema } from "prosemirror-model";

import { newId } from "../shared/ids";
import { AUDIO_PROMPT_NODE, AUDIO_PROMPT_STEM_NODE } from "./schema";

export function buildAudioPrompt(
  schema: Schema,
  prompt: string,
  attrs?: { attempts?: number; allowPlayback?: boolean; allowUpload?: boolean },
): PmNode {
  const item = schema.nodes[AUDIO_PROMPT_NODE];
  const stemType = schema.nodes[AUDIO_PROMPT_STEM_NODE];
  const paragraphType = schema.nodes["paragraph"];
  if (!item || !stemType || !paragraphType) {
    throw new Error("Audio-prompt schema not installed. Is the item registered?");
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
      itemId: newId("aud"),
      attempts: Math.max(1, attrs?.attempts ?? 1),
      allowPlayback: attrs?.allowPlayback ?? true,
      allowUpload: attrs?.allowUpload ?? false,
    },
    stem,
  );
}

export function constructAudioPrompt(schema: Schema): PmNode {
  return buildAudioPrompt(schema, "Record your answer");
}
