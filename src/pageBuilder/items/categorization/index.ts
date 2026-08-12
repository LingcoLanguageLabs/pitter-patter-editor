/**
 * Categorization — the assembled `ItemDefinition`. Importing it loads the
 * item's CSS. Builder (shuffle) groups item cards into category buckets;
 * completer (dnd-kit grid or radio matrix) lets the student do the grouping.
 */

import type { ItemDefinition } from "../types";
import { categorizationCatalog } from "./catalog";
import { CategorizationCompleter } from "./Completer";
import { constructCategorization } from "./create";
import { gradeCategorization } from "./grade";
import {
  CatCategoryView,
  CatItemView,
  CatPromptView,
  CatView,
} from "./nodeViews";
import {
  CAT_CATEGORY_NODE,
  CAT_ITEM_NODE,
  CAT_NODE,
  CAT_PROMPT_NODE,
  catCategorySpec,
  catItemSpec,
  catPromptSpec,
  catSpec,
} from "./schema";
import { serializeCategorization, type CategorizationDef } from "./serialize";
import { CategorizationSettings } from "./SettingsForm";

import "./categorization.css";

const CAT_NODE_LABELS: Record<string, string> = {
  [CAT_NODE]: "Categorization",
  [CAT_PROMPT_NODE]: "Question",
  [CAT_CATEGORY_NODE]: "Category",
  [CAT_ITEM_NODE]: "Item",
};

export const categorizationItem: ItemDefinition<CategorizationDef> = {
  type: CAT_NODE,
  catalog: categorizationCatalog,
  nodes: {
    [CAT_NODE]: catSpec,
    [CAT_PROMPT_NODE]: catPromptSpec,
    [CAT_CATEGORY_NODE]: catCategorySpec,
    [CAT_ITEM_NODE]: catItemSpec,
  },
  nodeViews: {
    [CAT_NODE]: CatView,
    [CAT_PROMPT_NODE]: CatPromptView,
    [CAT_CATEGORY_NODE]: CatCategoryView,
    [CAT_ITEM_NODE]: CatItemView,
  },
  construct: constructCategorization,
  serialize: serializeCategorization,
  Completer: CategorizationCompleter,
  grade: gradeCategorization,
  SettingsForm: CategorizationSettings,
  nodeLabels: CAT_NODE_LABELS,
};

export { buildCategorization } from "./create";
export type { CategorizationDef } from "./serialize";
