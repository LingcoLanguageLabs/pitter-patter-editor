import { Star } from "@phosphor-icons/react";

import type { ItemCatalogEntry } from "../types";
import { RATING_NODE } from "./schema";

export const ratingCatalog: ItemCatalogEntry = {
  type: RATING_NODE,
  label: "Rating",
  icon: Star,
  group: "Questions",
};
