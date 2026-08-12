import { ChatCircleDots, ListChecks } from "@phosphor-icons/react";

import type { ItemCatalogEntry } from "../types";
import { MC_NODE } from "./schema";

export const multipleChoiceCatalog: ItemCatalogEntry = {
  type: MC_NODE,
  label: "Multiple Choice",
  icon: ListChecks,
  group: "Questions",
};

/** Extra picker rows for the same `mc` node, differing only by preset attrs.
 *  "Opinion poll" is MC in completion mode (no right answer; any selection earns
 *  credit) — the attrs ride through `createBlockNode` → `construct`. */
export const multipleChoiceCatalogPresets: ItemCatalogEntry[] = [
  {
    type: MC_NODE,
    label: "Opinion poll",
    icon: ChatCircleDots,
    group: "Questions",
    attrs: { scoringMode: "completion", multiple: true },
  },
];
