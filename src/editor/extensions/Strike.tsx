import { TextStrikethrough } from "@phosphor-icons/react";
import { toggleMark } from "prosemirror-commands";
import type { MarkSpec } from "prosemirror-model";

import { useEditor } from "../Editor";
import { isMarkActive } from "../helpers";
import { ToggleMarkItem } from "../menu";
import { Extension } from "../types";

const strikeSpec: MarkSpec = {
  parseDOM: [
    { tag: "s" },
    { tag: "strike" },
    { tag: "del" },
    {
      style: "text-decoration",
      getAttrs: (value) => (value === "line-through" ? null : false),
    },
  ],
  toDOM() {
    return ["s", 0];
  },
};

function StrikeToolbarItem() {
  const { schema } = useEditor();
  const markType = schema.marks["strike"];
  if (!markType) return null;
  return (
    <ToggleMarkItem markType={markType} tooltip="Strikethrough" shortcut="⌘⇧S">
      <TextStrikethrough size={18} weight="bold" />
    </ToggleMarkItem>
  );
}

export const Strike = Extension.create({
  name: "strike",
  marks: { strike: strikeSpec },
  commands: {
    strike: (schema) => toggleMark(schema.marks["strike"]!),
  },
  keymap: { "Mod-Shift-s": "strike", "Mod-Shift-S": "strike" },
  isActive: (state, schema) => isMarkActive(state, schema.marks["strike"]!),
  toolbar: StrikeToolbarItem,
  meta: { label: "Strikethrough", shortcut: "⌘⇧S", group: "format", Icon: TextStrikethrough },
});
