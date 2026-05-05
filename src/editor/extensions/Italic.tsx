import { TextItalic } from "@phosphor-icons/react";
import { toggleMark } from "prosemirror-commands";
import { schema as basicSchema } from "prosemirror-schema-basic";

import { useEditor } from "../Editor";
import { isMarkActive } from "../helpers";
import { ToggleMarkItem } from "../menu";
import { Extension } from "../types";

const emSpec = basicSchema.spec.marks.get("em");
if (!emSpec) throw new Error("em mark missing from basic schema");

function ItalicToolbarItem() {
  const { schema } = useEditor();
  const markType = schema.marks["em"];
  if (!markType) return null;
  return (
    <ToggleMarkItem markType={markType} tooltip="Italic" shortcut="⌘I">
      <TextItalic size={18} weight="bold" />
    </ToggleMarkItem>
  );
}

export const Italic = Extension.create({
  name: "italic",
  marks: { em: emSpec },
  commands: {
    italic: (schema) => toggleMark(schema.marks["em"]!),
  },
  keymap: { "Mod-i": "italic", "Mod-I": "italic" },
  isActive: (state, schema) => isMarkActive(state, schema.marks["em"]!),
  toolbar: ItalicToolbarItem,
  meta: { label: "Italic", shortcut: "⌘I", group: "format", Icon: TextItalic },
});
