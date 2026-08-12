/**
 * Audio Prompt — the assembled `ItemDefinition`. The one export the registry
 * imports; importing it also loads the item's CSS. A record-your-answer
 * question: a rich stem + a MediaRecorder-backed recorder (in the completer)
 * with configurable attempts, playback, and upload.
 */

import type { ItemDefinition } from "../types";
import { AudioPromptCompleter } from "./Completer";
import { audioPromptCatalog } from "./catalog";
import { constructAudioPrompt } from "./create";
import { AudioPromptStemView, AudioPromptView } from "./nodeViews";
import { AudioPromptSettings } from "./SettingsForm";
import {
  AUDIO_PROMPT_NODE,
  AUDIO_PROMPT_STEM_NODE,
  audioPromptSpec,
  audioPromptStemSpec,
} from "./schema";
import { serializeAudioPrompt, type AudioPromptDef } from "./serialize";

import "./audioPrompt.css";

const AUDIO_PROMPT_NODE_LABELS: Record<string, string> = {
  [AUDIO_PROMPT_NODE]: "Audio Prompt",
  [AUDIO_PROMPT_STEM_NODE]: "Question",
};

export const audioPromptItem: ItemDefinition<AudioPromptDef> = {
  type: AUDIO_PROMPT_NODE,
  catalog: audioPromptCatalog,
  nodes: {
    [AUDIO_PROMPT_NODE]: audioPromptSpec,
    [AUDIO_PROMPT_STEM_NODE]: audioPromptStemSpec,
  },
  nodeViews: {
    [AUDIO_PROMPT_NODE]: AudioPromptView,
    [AUDIO_PROMPT_STEM_NODE]: AudioPromptStemView,
  },
  construct: constructAudioPrompt,
  serialize: serializeAudioPrompt,
  Completer: AudioPromptCompleter,
  SettingsForm: AudioPromptSettings,
  nodeLabels: AUDIO_PROMPT_NODE_LABELS,
};

export { buildAudioPrompt } from "./create";
export type { AudioPromptDef } from "./serialize";
