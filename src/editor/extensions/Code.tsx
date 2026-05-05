import { Code as CodeIcon } from "@phosphor-icons/react";
import { toggleMark } from "prosemirror-commands";
import { schema as basicSchema } from "prosemirror-schema-basic";

import { useEditor } from "../Editor";
import { isMarkActive } from "../helpers";
import { ToggleMarkItem } from "../menu";
import { Extension } from "../types";

const codeSpec = basicSchema.spec.marks.get("code");
if (!codeSpec) throw new Error("code mark missing from basic schema");

function CodeToolbarItem() {
  const { schema } = useEditor();
  const markType = schema.marks["code"];
  if (!markType) return null;
  return (
    <ToggleMarkItem markType={markType} tooltip="Code" shortcut="⌘E">
      <CodeIcon size={18} weight="bold" />
    </ToggleMarkItem>
  );
}

export const Code = Extension.create({
  name: "code",
  marks: { code: codeSpec },
  commands: {
    code: (schema) => toggleMark(schema.marks["code"]!),
  },
  keymap: { "Mod-e": "code", "Mod-E": "code" },
  isActive: (state, schema) => isMarkActive(state, schema.marks["code"]!),
  toolbar: CodeToolbarItem,
  meta: { label: "Code", shortcut: "⌘E", group: "format", Icon: CodeIcon },
});
