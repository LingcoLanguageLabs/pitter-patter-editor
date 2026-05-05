import { Quotes } from "@phosphor-icons/react";
import { useEditorState } from "@handlewithcare/react-prosemirror";
import type { EditorState } from "prosemirror-state";

import { useEditor } from "../Editor";
import { isAncestorActive, toggleWrap } from "../helpers";
import { CommandItem } from "../menu";
import { Extension } from "../types";

function QuoteToolbarItem() {
  const { schema } = useEditor();
  const editorState = useEditorState();
  const blockquoteType = schema.nodes["blockquote"];
  if (!blockquoteType) return null;

  const command = toggleWrap(blockquoteType);
  const active = isAncestorActive(editorState as EditorState | null, blockquoteType);

  return (
    <CommandItem command={command} active={active} tooltip="Blockquote" shortcut="⌘⇧.">
      <Quotes size={18} weight="bold" />
    </CommandItem>
  );
}

export const Quote = Extension.create({
  name: "quote",
  commands: {
    quote: (schema) => toggleWrap(schema.nodes["blockquote"]!),
  },
  keymap: { "Mod-Shift-.": "quote" },
  isActive: (state, schema) => isAncestorActive(state, schema.nodes["blockquote"]!),
  toolbar: QuoteToolbarItem,
  meta: { label: "Blockquote", shortcut: "⌘⇧.", group: "block", Icon: Quotes },
});
