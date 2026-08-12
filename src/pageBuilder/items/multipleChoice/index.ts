/**
 * Multiple Choice — the assembled `ItemDefinition`. This is the one export the
 * registry imports; importing it also loads the item's CSS. Use this folder as
 * the template for new item types.
 */

import type { ItemDefinition } from "../types";
import { MultipleChoiceCompleter } from "./Completer";
import { multipleChoiceCatalog, multipleChoiceCatalogPresets } from "./catalog";
import { constructMultipleChoice } from "./create";
import { gradeMultipleChoice } from "./grade";
import { McOptionView, McPromptView, McView } from "./nodeViews";
import { MultipleChoiceSettings } from "./SettingsForm";
import {
  MC_NODE,
  MC_OPTION_NODE,
  MC_PROMPT_NODE,
  mcOptionSpec,
  mcPromptSpec,
  mcSpec,
} from "./schema";

const MC_NODE_LABELS: Record<string, string> = {
  [MC_NODE]: "Multiple Choice",
  [MC_PROMPT_NODE]: "Question",
  [MC_OPTION_NODE]: "Option",
};
import { serializeMultipleChoice, type MultipleChoiceDef } from "./serialize";

import "./multipleChoice.css";

export const multipleChoiceItem: ItemDefinition<MultipleChoiceDef> = {
  type: MC_NODE,
  catalog: multipleChoiceCatalog,
  catalogPresets: multipleChoiceCatalogPresets,
  nodes: {
    [MC_NODE]: mcSpec,
    [MC_PROMPT_NODE]: mcPromptSpec,
    [MC_OPTION_NODE]: mcOptionSpec,
  },
  nodeViews: {
    [MC_NODE]: McView,
    [MC_PROMPT_NODE]: McPromptView,
    [MC_OPTION_NODE]: McOptionView,
  },
  construct: constructMultipleChoice,
  serialize: serializeMultipleChoice,
  Completer: MultipleChoiceCompleter,
  grade: gradeMultipleChoice,
  SettingsForm: MultipleChoiceSettings,
  nodeLabels: MC_NODE_LABELS,
};

export { buildMultipleChoice } from "./create";
export type { MultipleChoiceDef } from "./serialize";
