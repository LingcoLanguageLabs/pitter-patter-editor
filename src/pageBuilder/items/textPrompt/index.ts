/**
 * Text Prompt — the assembled `ItemDefinition`. The one export the registry
 * imports; importing it also loads the item's CSS. A free-response question: a
 * rich stem + a short (single-line) or long (resizable textarea) answer field,
 * with a custom placeholder edited under the Attributes section.
 */

import type { ItemDefinition } from "../types";
import { TextPromptCompleter } from "./Completer";
import { textPromptCatalog } from "./catalog";
import { constructTextPrompt } from "./create";
import { TextPromptStemView, TextPromptView } from "./nodeViews";
import { TextPromptSettings } from "./SettingsForm";
import {
  TEXT_PROMPT_NODE,
  TEXT_PROMPT_STEM_NODE,
  textPromptSpec,
  textPromptStemSpec,
} from "./schema";
import { serializeTextPrompt, type TextPromptDef } from "./serialize";

import "./textPrompt.css";

const TEXT_PROMPT_NODE_LABELS: Record<string, string> = {
  [TEXT_PROMPT_NODE]: "Text Prompt",
  [TEXT_PROMPT_STEM_NODE]: "Question",
};

export const textPromptItem: ItemDefinition<TextPromptDef> = {
  type: TEXT_PROMPT_NODE,
  catalog: textPromptCatalog,
  nodes: {
    [TEXT_PROMPT_NODE]: textPromptSpec,
    [TEXT_PROMPT_STEM_NODE]: textPromptStemSpec,
  },
  nodeViews: {
    [TEXT_PROMPT_NODE]: TextPromptView,
    [TEXT_PROMPT_STEM_NODE]: TextPromptStemView,
  },
  construct: constructTextPrompt,
  serialize: serializeTextPrompt,
  Completer: TextPromptCompleter,
  SettingsForm: TextPromptSettings,
  nodeLabels: TEXT_PROMPT_NODE_LABELS,
};

export { buildTextPrompt } from "./create";
export type { TextPromptDef } from "./serialize";
