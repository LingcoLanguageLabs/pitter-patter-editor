import { Quotes } from "@phosphor-icons/react";
import { useEditorState } from "@handlewithcare/react-prosemirror";
import type { NodeSpec } from "prosemirror-model";
import type { EditorState } from "prosemirror-state";

import { useEditor } from "../Editor";
import { isAncestorActive, toggleWrap } from "../helpers";
import { CommandItem } from "../menu";
import { Extension } from "../types";

const pullQuoteSpec: NodeSpec = {
  content: "paragraph+",
  group: "block",
  defining: true,
  parseDOM: [{ tag: "aside.pp-pullquote" }],
  toDOM: () => ["aside", { class: "pp-pullquote" }, 0],
};

function PullQuoteToolbarItem() {
  const { schema } = useEditor();
  const editorState = useEditorState();
  const pqType = schema.nodes["pull_quote"];
  if (!pqType) return null;
  const command = toggleWrap(pqType);
  const active = isAncestorActive(editorState as EditorState | null, pqType);
  return (
    <CommandItem command={command} active={active} tooltip="Pull quote">
      <Quotes size={18} weight="bold" />
    </CommandItem>
  );
}

export const PullQuote = Extension.create({
  name: "pull-quote",
  nodes: { pull_quote: pullQuoteSpec },
  commands: {
    "pull-quote": (schema) => toggleWrap(schema.nodes["pull_quote"]!),
  },
  isActive: (state, schema) =>
    isAncestorActive(state, schema.nodes["pull_quote"]!),
  toolbar: PullQuoteToolbarItem,
  meta: { label: "Pull quote", group: "block", Icon: Quotes },
});
