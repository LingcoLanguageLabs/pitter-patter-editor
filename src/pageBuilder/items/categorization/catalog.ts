import { Cards } from "@phosphor-icons/react";

import type { ItemCatalogEntry } from "../types";
import { CAT_NODE } from "./schema";

export const categorizationCatalog: ItemCatalogEntry = {
  type: CAT_NODE,
  label: "Categorization",
  icon: Cards,
  group: "Questions",
};
