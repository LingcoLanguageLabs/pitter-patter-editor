import { useEditorState } from "@handlewithcare/react-prosemirror";
import type { Node as PmNode } from "prosemirror-model";
import { Plugin, PluginKey } from "prosemirror-state";
import { useMemo } from "react";

import { Extension } from "../types";

export interface DocumentStatistics {
  characters: number;
  /** Whitespace-separated tokens. */
  words: number;
  /** Non-empty paragraph blocks. */
  paragraphs: number;
  /** Heading blocks (h1..h6). */
  headings: number;
  /** Reading time in minutes, computed at the configured WPM. */
  readingTimeMinutes: number;
}

interface InternalStats {
  characters: number;
  words: number;
  paragraphs: number;
  headings: number;
}

export const statisticsKey = new PluginKey<InternalStats>("pp-statistics");

function compute(doc: PmNode): InternalStats {
  const text = doc.textContent;
  const trimmed = text.trim();
  let paragraphs = 0;
  let headings = 0;
  doc.descendants((node) => {
    if (node.type.name === "paragraph" && node.content.size > 0) paragraphs++;
    else if (node.type.name === "heading") headings++;
  });
  return {
    characters: text.length,
    words: trimmed === "" ? 0 : trimmed.split(/\s+/).length,
    paragraphs,
    headings,
  };
}

export interface StatisticsOptions {
  /** Words per minute used to compute reading time. Default: 250. */
  wordsPerMinute?: number;
}

const DEFAULT_WPM = 250;

let configuredWpm = DEFAULT_WPM;

export function createStatistics({
  wordsPerMinute = DEFAULT_WPM,
}: StatisticsOptions = {}) {
  configuredWpm = wordsPerMinute;
  return Extension.create({
    name: "statistics",
    plugins: () => [
      new Plugin<InternalStats>({
        key: statisticsKey,
        state: {
          init: (_, state) => compute(state.doc),
          apply: (tr, prev) => (tr.docChanged ? compute(tr.doc) : prev),
        },
      }),
    ],
    meta: { label: "Document statistics", group: "system" },
  });
}

export const Statistics = createStatistics();

/**
 * Hook returning rich document statistics. Reads from the cached plugin
 * state, so it's O(1) per render once the doc has been measured.
 */
export function useStatistics({
  wordsPerMinute,
}: StatisticsOptions = {}): DocumentStatistics {
  const state = useEditorState();
  const wpm = wordsPerMinute ?? configuredWpm;
  return useMemo(() => {
    const internal = state ? statisticsKey.getState(state) : null;
    const base: InternalStats = internal ?? {
      characters: 0,
      words: 0,
      paragraphs: 0,
      headings: 0,
    };
    return {
      ...base,
      readingTimeMinutes: wpm > 0 ? base.words / wpm : 0,
    };
  }, [state, wpm]);
}
