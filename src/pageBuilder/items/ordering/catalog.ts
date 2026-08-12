import { ListNumbers } from "@phosphor-icons/react";

import type { ItemCatalogEntry } from "../types";
import { ORD_NODE } from "./schema";

export const orderingCatalog: ItemCatalogEntry = {
  type: ORD_NODE,
  label: "Ordering",
  icon: ListNumbers,
  group: "Questions",
};
