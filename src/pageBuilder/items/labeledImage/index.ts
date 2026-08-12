/**
 * Labeled image — the assembled `ItemDefinition`. A CONTENT item (the
 * exploratory cousin of Hotspot): the author marks an image with point markers
 * carrying a title + description, and the student taps a marker (or its chip) to
 * read about it. No grading — `grade` is omitted, so it carries no credit.
 * Importing it loads the item's CSS.
 */

import type { ItemDefinition } from "../types";
import { labeledImageCatalog } from "./catalog";
import { LabeledImageCompleter } from "./Completer";
import { constructLabeledImage } from "./create";
import { LabeledImagePromptView, LabeledImageView } from "./nodeViews";
import {
  LABELED_IMAGE_NODE,
  LABELED_IMAGE_PROMPT_NODE,
  labeledImagePromptSpec,
  labeledImageSpec,
} from "./schema";
import { serializeLabeledImage, type LabeledImageDef } from "./serialize";
import { LabeledImageSettings } from "./SettingsForm";

import "./labeledImage.css";

const LABELED_IMAGE_NODE_LABELS: Record<string, string> = {
  [LABELED_IMAGE_NODE]: "Labeled image",
  [LABELED_IMAGE_PROMPT_NODE]: "Intro",
};

export const labeledImageItem: ItemDefinition<LabeledImageDef> = {
  type: LABELED_IMAGE_NODE,
  catalog: labeledImageCatalog,
  nodes: {
    [LABELED_IMAGE_NODE]: labeledImageSpec,
    [LABELED_IMAGE_PROMPT_NODE]: labeledImagePromptSpec,
  },
  nodeViews: {
    [LABELED_IMAGE_NODE]: LabeledImageView,
    [LABELED_IMAGE_PROMPT_NODE]: LabeledImagePromptView,
  },
  construct: constructLabeledImage,
  serialize: serializeLabeledImage,
  Completer: LabeledImageCompleter,
  // No `grade` — this is an exploratory/content item (no answer key, no credit).
  SettingsForm: LabeledImageSettings,
  nodeLabels: LABELED_IMAGE_NODE_LABELS,
};

export { buildLabeledImage } from "./create";
export type { LabeledImageDef } from "./serialize";
