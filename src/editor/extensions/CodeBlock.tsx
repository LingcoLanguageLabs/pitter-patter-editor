import { CodeBlock as CodeBlockIcon } from "@phosphor-icons/react";
import { useEditorState } from "@handlewithcare/react-prosemirror";
import { setBlockType } from "prosemirror-commands";
import { textblockTypeInputRule } from "prosemirror-inputrules";
import type { NodeType } from "prosemirror-model";
import type { Command, EditorState } from "prosemirror-state";

import { useEditor } from "../Editor";
import { isTextblockActive } from "../helpers";
import { CommandItem } from "../menu";
import { Extension } from "../types";

function toggleCodeBlock(codeBlockType: NodeType, paragraphType: NodeType): Command {
  return (state, dispatch, view) => {
    if (isTextblockActive(state, codeBlockType)) {
      return setBlockType(paragraphType)(state, dispatch, view);
    }
    return setBlockType(codeBlockType)(state, dispatch, view);
  };
}

function CodeBlockToolbarItem() {
  const { schema } = useEditor();
  const editorState = useEditorState();
  const codeBlockType = schema.nodes["code_block"];
  const paragraphType = schema.nodes["paragraph"];
  if (!codeBlockType || !paragraphType) return null;

  const active = isTextblockActive(editorState as EditorState | null, codeBlockType);

  return (
    <CommandItem
      command={toggleCodeBlock(codeBlockType, paragraphType)}
      active={active}
      tooltip="Code block"
      shortcut="⌘⌥C"
    >
      <CodeBlockIcon size={18} weight="bold" />
    </CommandItem>
  );
}

export const CodeBlock = Extension.create({
  name: "code-block",
  commands: {
    "code-block": (schema) =>
      toggleCodeBlock(schema.nodes["code_block"]!, schema.nodes["paragraph"]!),
  },
  keymap: { "Mod-Alt-c": "code-block", "Mod-Alt-C": "code-block" },
  inputRules: (schema) => {
    const codeBlockType = schema.nodes["code_block"];
    if (!codeBlockType) return [];
    return [textblockTypeInputRule(/^```$/, codeBlockType)];
  },
  isActive: (state, schema) => isTextblockActive(state, schema.nodes["code_block"]!),
  toolbar: CodeBlockToolbarItem,
  meta: { label: "Code block", shortcut: "⌘⌥C", group: "block", Icon: CodeBlockIcon },
});
