import { NotePencil } from "@phosphor-icons/react";

import type { ItemCatalogEntry } from "../types";
import { FB_NODE } from "./schema";

export const fillBlanksCatalog: ItemCatalogEntry = {
  type: FB_NODE,
  label: "Fill Blanks",
  icon: NotePencil,
  group: "Questions",
};
