import { TextSuperscript } from "@phosphor-icons/react";
import { toggleMark } from "prosemirror-commands";
import type { MarkSpec } from "prosemirror-model";

import { useEditor } from "../Editor";
import { isMarkActive } from "../helpers";
import { ToggleMarkItem } from "../menu";
import { Extension } from "../types";

const superscriptSpec: MarkSpec = {
  excludes: "subscript",
  parseDOM: [
    { tag: "sup" },
    {
      style: "vertical-align",
      getAttrs: (value) => (value === "super" ? null : false),
    },
  ],
  toDOM() {
    return ["sup", 0];
  },
};

function SuperscriptToolbarItem() {
  const { schema } = useEditor();
  const markType = schema.marks["superscript"];
  if (!markType) return null;
  return (
    <ToggleMarkItem markType={markType} tooltip="Superscript" shortcut="⌘.">
      <TextSuperscript size={18} weight="bold" />
    </ToggleMarkItem>
  );
}

export const Superscript = Extension.create({
  name: "superscript",
  marks: { superscript: superscriptSpec },
  commands: {
    superscript: (schema) => toggleMark(schema.marks["superscript"]!),
  },
  keymap: { "Mod-.": "superscript" },
  isActive: (state, schema) => isMarkActive(state, schema.marks["superscript"]!),
  toolbar: SuperscriptToolbarItem,
  meta: { label: "Superscript", shortcut: "⌘.", group: "format", Icon: TextSuperscript },
});
