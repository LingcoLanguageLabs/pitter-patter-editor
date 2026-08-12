/**
 * Hotspot — serialize() boundary. Doc JSON → a typed, PM-free payload the
 * completer consumes.
 */

import type { JsonNode } from "../../runtime/shuffleLayout";
import { serializeExplanation } from "../shared/explanation";
import { serializeFeedback, type FeedbackMessages } from "../shared/scoring";
import { coerceRegions, type HotspotRegion } from "./regions";
import { HOTSPOT_PROMPT_NODE } from "./schema";

export interface HotspotDef {
  itemId: string;
  points: number;
  /** "select" = tap visible regions; "find" = hidden regions, click to locate. */
  mode: "select" | "find";
  src: string;
  alt: string;
  regions: HotspotRegion[];
  feedback: FeedbackMessages;
  /** The "here's why" rationale (rich inline), shown in the feedback block. */
  explanation: JsonNode[];
  /** The instruction stem's content BLOCKS, rendered by the shared block walker. */
  prompt: JsonNode[];
}

export function serializeHotspot(node: JsonNode): HotspotDef {
  const a = node.attrs ?? {};
  const prompt =
    (node.content ?? []).find((c) => c.type === HOTSPOT_PROMPT_NODE)?.content ??
    [];
  return {
    itemId: (a["itemId"] as string) || "",
    points: typeof a["points"] === "number" ? (a["points"] as number) : 1,
    mode: a["mode"] === "find" ? "find" : "select",
    src: (a["src"] as string) || "",
    alt: (a["alt"] as string) || "",
    regions: coerceRegions(a["regions"]),
    feedback: serializeFeedback(a),
    explanation: serializeExplanation(node),
    prompt,
  };
}

/** Ids of the correct regions — the answer key. */
export function correctRegionIds(def: HotspotDef): Set<string> {
  return new Set(def.regions.filter((r) => r.correct).map((r) => r.id));
}
