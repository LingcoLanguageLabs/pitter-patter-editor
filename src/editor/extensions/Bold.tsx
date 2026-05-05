import { TextB } from "@phosphor-icons/react";
import { toggleMark } from "prosemirror-commands";
import { schema as basicSchema } from "prosemirror-schema-basic";

import { useEditor } from "../Editor";
import { isMarkActive } from "../helpers";
import { ToggleMarkItem } from "../menu";
import { Extension } from "../types";

const strongSpec = basicSchema.spec.marks.get("strong");
if (!strongSpec) throw new Error("strong mark missing from basic schema");

function BoldToolbarItem() {
  const { schema } = useEditor();
  const markType = schema.marks["strong"];
  if (!markType) return null;
  return (
    <ToggleMarkItem markType={markType} tooltip="Bold" shortcut="⌘B">
      <TextB size={18} weight="bold" />
    </ToggleMarkItem>
  );
}

export const Bold = Extension.create({
  name: "bold",
  marks: { strong: strongSpec },
  commands: {
    bold: (schema) => toggleMark(schema.marks["strong"]!),
  },
  keymap: { "Mod-b": "bold", "Mod-B": "bold" },
  isActive: (state, schema) => isMarkActive(state, schema.marks["strong"]!),
  toolbar: BoldToolbarItem,
  meta: { label: "Bold", shortcut: "⌘B", group: "format", Icon: TextB },
});
