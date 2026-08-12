import { Textbox } from "@phosphor-icons/react";

import type { ItemCatalogEntry } from "../types";
import { TEXT_PROMPT_NODE } from "./schema";

export const textPromptCatalog: ItemCatalogEntry = {
  type: TEXT_PROMPT_NODE,
  label: "Text Prompt",
  icon: Textbox,
  group: "Questions",
};
