/**
 * Hotspot — the assembled `ItemDefinition`. An assessment item: the author marks
 * an image with regions (boxes / points), some correct, and the student clicks
 * the ones they think are right. Graded by correctness. Importing it loads the
 * item's CSS.
 */

import type { ItemDefinition } from "../types";
import { hotspotCatalog } from "./catalog";
import { HotspotCompleter } from "./Completer";
import { constructHotspot } from "./create";
import { gradeHotspot } from "./grade";
import { HotspotPromptView, HotspotView } from "./nodeViews";
import {
  HOTSPOT_NODE,
  HOTSPOT_PROMPT_NODE,
  hotspotPromptSpec,
  hotspotSpec,
} from "./schema";
import { serializeHotspot, type HotspotDef } from "./serialize";
import { HotspotSettings } from "./SettingsForm";

import "./hotspot.css";

const HOTSPOT_NODE_LABELS: Record<string, string> = {
  [HOTSPOT_NODE]: "Hotspot",
  [HOTSPOT_PROMPT_NODE]: "Question",
};

export const hotspotItem: ItemDefinition<HotspotDef> = {
  type: HOTSPOT_NODE,
  catalog: hotspotCatalog,
  nodes: {
    [HOTSPOT_NODE]: hotspotSpec,
    [HOTSPOT_PROMPT_NODE]: hotspotPromptSpec,
  },
  nodeViews: {
    [HOTSPOT_NODE]: HotspotView,
    [HOTSPOT_PROMPT_NODE]: HotspotPromptView,
  },
  construct: constructHotspot,
  serialize: serializeHotspot,
  Completer: HotspotCompleter,
  grade: gradeHotspot,
  SettingsForm: HotspotSettings,
  nodeLabels: HOTSPOT_NODE_LABELS,
};

export { buildHotspot } from "./create";
export type { HotspotDef } from "./serialize";
