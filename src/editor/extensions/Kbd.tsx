import { Keyboard } from "@phosphor-icons/react";
import { useEditorState } from "@handlewithcare/react-prosemirror";
import { toggleMark } from "prosemirror-commands";
import type { MarkSpec } from "prosemirror-model";
import type { EditorState } from "prosemirror-state";

import { useEditor } from "../Editor";
import { isMarkActive } from "../helpers";
import { CommandItem } from "../menu";
import { Extension } from "../types";

const kbdSpec: MarkSpec = {
  parseDOM: [{ tag: "kbd" }],
  toDOM: () => ["kbd", { class: "pp-kbd" }, 0],
  excludes: "_",
};

function KbdToolbarItem() {
  const { schema } = useEditor();
  const editorState = useEditorState();
  const markType = schema.marks["kbd"];
  if (!markType) return null;
  const command = toggleMark(markType);
  const active = isMarkActive(editorState as EditorState | null, markType);
  return (
    <CommandItem
      command={command}
      active={active}
      tooltip="Keyboard shortcut"
      shortcut="⌘⌥K"
    >
      <Keyboard size={18} weight="bold" />
    </CommandItem>
  );
}

export const Kbd = Extension.create({
  name: "kbd",
  marks: { kbd: kbdSpec },
  commands: {
    kbd: (schema) => toggleMark(schema.marks["kbd"]!),
  },
  keymap: { "Mod-Alt-k": "kbd" },
  isActive: (state, schema) => isMarkActive(state, schema.marks["kbd"]!),
  toolbar: KbdToolbarItem,
  meta: { label: "Keyboard shortcut", group: "format", Icon: Keyboard },
});
