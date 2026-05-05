import { TextUnderline } from "@phosphor-icons/react";
import { toggleMark } from "prosemirror-commands";
import type { MarkSpec } from "prosemirror-model";

import { useEditor } from "../Editor";
import { isMarkActive } from "../helpers";
import { ToggleMarkItem } from "../menu";
import { Extension } from "../types";

const underlineSpec: MarkSpec = {
  parseDOM: [
    { tag: "u" },
    {
      style: "text-decoration",
      getAttrs: (value) => (value === "underline" ? null : false),
    },
  ],
  toDOM() {
    return ["u", 0];
  },
};

function UnderlineToolbarItem() {
  const { schema } = useEditor();
  const markType = schema.marks["underline"];
  if (!markType) return null;
  return (
    <ToggleMarkItem markType={markType} tooltip="Underline" shortcut="⌘U">
      <TextUnderline size={18} weight="bold" />
    </ToggleMarkItem>
  );
}

export const Underline = Extension.create({
  name: "underline",
  marks: { underline: underlineSpec },
  commands: {
    underline: (schema) => toggleMark(schema.marks["underline"]!),
  },
  keymap: { "Mod-u": "underline", "Mod-U": "underline" },
  isActive: (state, schema) => isMarkActive(state, schema.marks["underline"]!),
  toolbar: UnderlineToolbarItem,
  meta: { label: "Underline", shortcut: "⌘U", group: "format", Icon: TextUnderline },
});
