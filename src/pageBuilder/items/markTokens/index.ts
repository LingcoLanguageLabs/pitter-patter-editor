/**
 * Mark the Words — the assembled `ItemDefinition`. Importing it loads the item's
 * CSS. The click-the-words cousin of Fill Blanks: a `mttoken` MARK (not a node)
 * flags the correct words, applied via a "Mark target" toolbar action. No
 * SelectionPopover — a marked word has no per-token settings, so toggling the
 * mark is the whole interaction.
 */

import type { ItemDefinition } from "../types";
import { markTokensCatalog } from "./catalog";
import { markTokenAction } from "./commands";
import { MarkTokensCompleter } from "./Completer";
import { constructMarkTokens } from "./create";
import { gradeMarkTokens } from "./grade";
import { MtPromptView, MtTextView, MtView } from "./nodeViews";
import {
  MTTOKEN_MARK,
  MT_NODE,
  MT_PROMPT_NODE,
  MT_TEXT_NODE,
  mtPromptSpec,
  mtSpec,
  mtTextSpec,
  mttokenSpec,
} from "./schema";
import { serializeMarkTokens, type MarkTokensDef } from "./serialize";
import { MarkTokensSettings } from "./SettingsForm";

import "./markTokens.css";

const MT_NODE_LABELS: Record<string, string> = {
  [MT_NODE]: "Mark Tokens",
  [MT_PROMPT_NODE]: "Question",
  [MT_TEXT_NODE]: "Markable text",
};

export const markTokensItem: ItemDefinition<MarkTokensDef> = {
  type: MT_NODE,
  catalog: markTokensCatalog,
  nodes: {
    [MT_NODE]: mtSpec,
    [MT_PROMPT_NODE]: mtPromptSpec,
    [MT_TEXT_NODE]: mtTextSpec,
  },
  marks: {
    [MTTOKEN_MARK]: mttokenSpec,
  },
  nodeViews: {
    [MT_NODE]: MtView,
    [MT_PROMPT_NODE]: MtPromptView,
    [MT_TEXT_NODE]: MtTextView,
  },
  construct: constructMarkTokens,
  serialize: serializeMarkTokens,
  Completer: MarkTokensCompleter,
  grade: gradeMarkTokens,
  SettingsForm: MarkTokensSettings,
  nodeLabels: MT_NODE_LABELS,
  selectionActions: [markTokenAction],
};

export { buildMarkTokens } from "./create";
export type { MarkTokensDef } from "./serialize";
