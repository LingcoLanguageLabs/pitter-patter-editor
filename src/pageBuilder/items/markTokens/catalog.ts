import { Highlighter } from "@phosphor-icons/react";

import type { ItemCatalogEntry } from "../types";
import { MT_NODE } from "./schema";

export const markTokensCatalog: ItemCatalogEntry = {
  type: MT_NODE,
  label: "Mark Tokens",
  icon: Highlighter,
  group: "Questions",
};
