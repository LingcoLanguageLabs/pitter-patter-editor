import { Notebook } from "@phosphor-icons/react";
import { useEditorState } from "@handlewithcare/react-prosemirror";
import type { NodeSpec, Schema } from "prosemirror-model";
import { TextSelection, type Command, type EditorState } from "prosemirror-state";

import { useEditor } from "../Editor";
import { isAncestorActive } from "../helpers";
import { CommandItem } from "../menu";
import { Extension } from "../types";

const definitionListSpec: NodeSpec = {
  content: "(definition_term definition_description)+",
  group: "block",
  defining: true,
  parseDOM: [{ tag: "dl" }],
  toDOM: () => ["dl", { class: "pp-dl" }, 0],
};

const definitionTermSpec: NodeSpec = {
  content: "inline*",
  defining: true,
  parseDOM: [{ tag: "dt" }],
  toDOM: () => ["dt", 0],
};

const definitionDescriptionSpec: NodeSpec = {
  content: "paragraph+",
  defining: true,
  parseDOM: [{ tag: "dd" }],
  toDOM: () => ["dd", 0],
};

function insertDefinitionList(schema: Schema): Command {
  const dlType = schema.nodes["definition_list"];
  const dtType = schema.nodes["definition_term"];
  const ddType = schema.nodes["definition_description"];
  const pType = schema.nodes["paragraph"];
  return (state, dispatch) => {
    if (!dlType || !dtType || !ddType || !pType) return false;
    if (!dispatch) return true;
    const node = dlType.create(null, [
      dtType.create(),
      ddType.create(null, pType.create()),
    ]);
    const tr = state.tr.replaceSelectionWith(node);
    // Place caret at the start of the new <dt>.
    const insertedAt = tr.mapping.map(state.selection.from) - node.nodeSize + 2;
    const $caret = tr.doc.resolve(insertedAt);
    tr.setSelection(TextSelection.near($caret));
    dispatch(tr.scrollIntoView());
    return true;
  };
}

function DefinitionListToolbarItem() {
  const { schema } = useEditor();
  const editorState = useEditorState();
  const dlType = schema.nodes["definition_list"];
  if (!dlType) return null;
  const command = insertDefinitionList(schema);
  const active = isAncestorActive(editorState as EditorState | null, dlType);
  return (
    <CommandItem command={command} active={active} tooltip="Definition list">
      <Notebook size={18} weight="bold" />
    </CommandItem>
  );
}

export const DefinitionList = Extension.create({
  name: "definition-list",
  nodes: {
    definition_list: definitionListSpec,
    definition_term: definitionTermSpec,
    definition_description: definitionDescriptionSpec,
  },
  commands: {
    "definition-list": (schema) => insertDefinitionList(schema),
  },
  toolbar: DefinitionListToolbarItem,
  meta: { label: "Definition list", group: "block", Icon: Notebook },
});
