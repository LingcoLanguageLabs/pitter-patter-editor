import { TextSubscript } from "@phosphor-icons/react";
import { toggleMark } from "prosemirror-commands";
import type { MarkSpec } from "prosemirror-model";

import { useEditor } from "../Editor";
import { isMarkActive } from "../helpers";
import { ToggleMarkItem } from "../menu";
import { Extension } from "../types";

const subscriptSpec: MarkSpec = {
  excludes: "superscript",
  parseDOM: [
    { tag: "sub" },
    {
      style: "vertical-align",
      getAttrs: (value) => (value === "sub" ? null : false),
    },
  ],
  toDOM() {
    return ["sub", 0];
  },
};

function SubscriptToolbarItem() {
  const { schema } = useEditor();
  const markType = schema.marks["subscript"];
  if (!markType) return null;
  return (
    <ToggleMarkItem markType={markType} tooltip="Subscript" shortcut="⌘,">
      <TextSubscript size={18} weight="bold" />
    </ToggleMarkItem>
  );
}

export const Subscript = Extension.create({
  name: "subscript",
  marks: { subscript: subscriptSpec },
  commands: {
    subscript: (schema) => toggleMark(schema.marks["subscript"]!),
  },
  keymap: { "Mod-,": "subscript" },
  isActive: (state, schema) => isMarkActive(state, schema.marks["subscript"]!),
  toolbar: SubscriptToolbarItem,
  meta: { label: "Subscript", shortcut: "⌘,", group: "format", Icon: TextSubscript },
});
