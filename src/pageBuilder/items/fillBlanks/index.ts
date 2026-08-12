/**
 * Fill Blanks — the assembled `ItemDefinition`. Importing it loads the item's
 * CSS. Demonstrates the inline-node + selection-action extensions to the item
 * contract (a `blank` inline node + a "Mark as blank" toolbar action).
 */

import type { ItemDefinition } from "../types";
import { BlankView, FbView } from "./nodeViews";
import { BlankSettingsPopover } from "./BlankSettingsPopover";
import { fillBlanksCatalog } from "./catalog";
import { markBlankAction } from "./commands";
import { constructFillBlanks } from "./create";
import { FillBlanksCompleter } from "./Completer";
import { gradeFillBlanks } from "./grade";
import { BLANK_NODE, blankSpec, FB_NODE, fbSpec } from "./schema";
import { serializeFillBlanks, type FillBlanksDef } from "./serialize";
import { FillBlanksSettings } from "./SettingsForm";

import "./fillBlanks.css";

const FB_NODE_LABELS: Record<string, string> = {
  [FB_NODE]: "Fill Blanks",
  [BLANK_NODE]: "Blank",
};

export const fillBlanksItem: ItemDefinition<FillBlanksDef> = {
  type: FB_NODE,
  catalog: fillBlanksCatalog,
  nodes: {
    [FB_NODE]: fbSpec,
    [BLANK_NODE]: blankSpec,
  },
  nodeViews: {
    [FB_NODE]: FbView,
    [BLANK_NODE]: BlankView,
  },
  construct: constructFillBlanks,
  serialize: serializeFillBlanks,
  Completer: FillBlanksCompleter,
  grade: gradeFillBlanks,
  SettingsForm: FillBlanksSettings,
  nodeLabels: FB_NODE_LABELS,
  inlineNodes: [BLANK_NODE],
  selectionActions: [markBlankAction],
  SelectionPopover: BlankSettingsPopover,
};

export { buildFillBlanks } from "./create";
export type { FillBlanksDef } from "./serialize";
