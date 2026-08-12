/**
 * Ordering — the assembled `ItemDefinition`. Importing it loads the item's CSS.
 * Builder (shuffle) sets the correct sequence; completer (`@dnd-kit/sortable`)
 * lets the student drag a shuffled list into order. The 1-D cousin of
 * Categorization.
 */

import type { ItemDefinition } from "../types";
import { orderingCatalog } from "./catalog";
import { OrderingCompleter } from "./Completer";
import { constructOrdering } from "./create";
import { gradeOrdering } from "./grade";
import { OrdItemView, OrdPromptView, OrdView } from "./nodeViews";
import {
  ORD_ITEM_NODE,
  ORD_NODE,
  ORD_PROMPT_NODE,
  ordItemSpec,
  ordPromptSpec,
  ordSpec,
} from "./schema";
import { serializeOrdering, type OrderingDef } from "./serialize";
import { OrderingSettings } from "./SettingsForm";

import "./ordering.css";

const ORD_NODE_LABELS: Record<string, string> = {
  [ORD_NODE]: "Ordering",
  [ORD_PROMPT_NODE]: "Question",
  [ORD_ITEM_NODE]: "Item",
};

export const orderingItem: ItemDefinition<OrderingDef> = {
  type: ORD_NODE,
  catalog: orderingCatalog,
  nodes: {
    [ORD_NODE]: ordSpec,
    [ORD_PROMPT_NODE]: ordPromptSpec,
    [ORD_ITEM_NODE]: ordItemSpec,
  },
  nodeViews: {
    [ORD_NODE]: OrdView,
    [ORD_PROMPT_NODE]: OrdPromptView,
    [ORD_ITEM_NODE]: OrdItemView,
  },
  construct: constructOrdering,
  serialize: serializeOrdering,
  Completer: OrderingCompleter,
  grade: gradeOrdering,
  SettingsForm: OrderingSettings,
  nodeLabels: ORD_NODE_LABELS,
};

export { buildOrdering } from "./create";
export type { OrderingDef } from "./serialize";
