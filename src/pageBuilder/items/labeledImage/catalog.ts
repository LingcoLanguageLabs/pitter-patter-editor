import { MapTrifold } from "@phosphor-icons/react";

import type { ItemCatalogEntry } from "../types";
import { LABELED_IMAGE_NODE } from "./schema";

export const labeledImageCatalog: ItemCatalogEntry = {
  type: LABELED_IMAGE_NODE,
  label: "Labeled image",
  icon: MapTrifold,
  group: "Questions",
};
