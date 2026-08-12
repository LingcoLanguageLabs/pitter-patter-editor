import { Microphone } from "@phosphor-icons/react";

import type { ItemCatalogEntry } from "../types";
import { AUDIO_PROMPT_NODE } from "./schema";

export const audioPromptCatalog: ItemCatalogEntry = {
  type: AUDIO_PROMPT_NODE,
  label: "Audio Prompt",
  icon: Microphone,
  group: "Questions",
};
