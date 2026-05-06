import { useEditorState } from "@handlewithcare/react-prosemirror";
import type { Node } from "prosemirror-model";
import { Plugin, PluginKey } from "prosemirror-state";

import { Extension } from "../types";

export interface CharacterCountState {
  characters: number;
  words: number;
}

export const characterCountKey = new PluginKey<CharacterCountState>(
  "pp-character-count",
);

function compute(doc: Node): CharacterCountState {
  const text = doc.textContent;
  const trimmed = text.trim();
  return {
    characters: text.length,
    words: trimmed === "" ? 0 : trimmed.split(/\s+/).length,
  };
}

/**
 * Plugin that caches `{ characters, words }` in its state and recomputes
 * only when the doc changes. Pair it with `useCharacterCount()` for a
 * cheap render-time read.
 */
export const CharacterCount = Extension.create({
  name: "character-count",
  plugins: () => [
    new Plugin<CharacterCountState>({
      key: characterCountKey,
      state: {
        init: (_, state) => compute(state.doc),
        apply: (tr, prev) => (tr.docChanged ? compute(tr.doc) : prev),
      },
    }),
  ],
  meta: { label: "Character count", group: "system" },
});

/**
 * Hook returning the current `{ characters, words }`. Returns zeros if
 * the editor isn't mounted yet or the plugin isn't installed.
 */
export function useCharacterCount(): CharacterCountState {
  const state = useEditorState();
  if (!state) return { characters: 0, words: 0 };
  return characterCountKey.getState(state) ?? { characters: 0, words: 0 };
}
