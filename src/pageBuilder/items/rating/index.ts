/**
 * Rating — the assembled `ItemDefinition`. A survey/opinion item (always
 * completion scoring): the student picks a value on a star / heart / emoji /
 * number scale. Importing it loads the item's CSS.
 */

import type { ItemDefinition } from "../types";
import { ratingCatalog } from "./catalog";
import { RatingCompleter } from "./Completer";
import { constructRating } from "./create";
import { gradeRating } from "./grade";
import { RatingPromptView, RatingView } from "./nodeViews";
import { RATING_NODE, RATING_PROMPT_NODE, ratingPromptSpec, ratingSpec } from "./schema";
import { serializeRating, type RatingDef } from "./serialize";
import { RatingSettings } from "./SettingsForm";

import "./rating.css";

const RATING_NODE_LABELS: Record<string, string> = {
  [RATING_NODE]: "Rating",
  [RATING_PROMPT_NODE]: "Question",
};

export const ratingItem: ItemDefinition<RatingDef> = {
  type: RATING_NODE,
  catalog: ratingCatalog,
  nodes: {
    [RATING_NODE]: ratingSpec,
    [RATING_PROMPT_NODE]: ratingPromptSpec,
  },
  nodeViews: {
    [RATING_NODE]: RatingView,
    [RATING_PROMPT_NODE]: RatingPromptView,
  },
  construct: constructRating,
  serialize: serializeRating,
  Completer: RatingCompleter,
  grade: gradeRating,
  SettingsForm: RatingSettings,
  nodeLabels: RATING_NODE_LABELS,
};

export { buildRating } from "./create";
export type { RatingDef } from "./serialize";
