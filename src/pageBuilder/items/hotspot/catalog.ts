import { MapPin } from "@phosphor-icons/react";

import type { ItemCatalogEntry } from "../types";
import { HOTSPOT_NODE } from "./schema";

export const hotspotCatalog: ItemCatalogEntry = {
  type: HOTSPOT_NODE,
  label: "Hotspot",
  icon: MapPin,
  group: "Questions",
};
