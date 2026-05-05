import { useEditorState } from "@handlewithcare/react-prosemirror";
import { setBlockType } from "prosemirror-commands";
import type { NodeType, Schema } from "prosemirror-model";
import type { Command, EditorState } from "prosemirror-state";

import { useEditor } from "../Editor";
import { isTextblockActive } from "../helpers";
import { Dropdown, DropdownItem } from "../menu";
import { Extension } from "../types";

interface StyleOption {
  id: string;
  label: string;
  shortLabel: string;
  command: Command;
  isActive: boolean;
  preview: React.ReactNode;
}

function toggleHeading(headingType: NodeType, paragraphType: NodeType, level: number): Command {
  return (state, dispatch, view) => {
    if (isTextblockActive(state, headingType, { level })) {
      return setBlockType(paragraphType)(state, dispatch, view);
    }
    return setBlockType(headingType, { level })(state, dispatch, view);
  };
}

function buildOptions(schema: Schema, editorState: EditorState | null): StyleOption[] {
  const paragraphType = schema.nodes["paragraph"];
  const headingType = schema.nodes["heading"];
  if (!paragraphType) return [];

  const options: StyleOption[] = [
    {
      id: "paragraph",
      label: "Paragraph",
      shortLabel: "Paragraph",
      command: setBlockType(paragraphType),
      isActive: isTextblockActive(editorState, paragraphType),
      preview: <span style={{ fontSize: 14 }}>Paragraph</span>,
    },
  ];

  if (headingType) {
    const sizes: Record<number, number> = { 1: 19, 2: 17, 3: 15, 4: 13 };
    for (const level of [1, 2, 3, 4] as const) {
      options.push({
        id: `heading-${level}`,
        label: `Heading ${level}`,
        shortLabel: `Heading ${level}`,
        command: toggleHeading(headingType, paragraphType, level),
        isActive: isTextblockActive(editorState, headingType, { level }),
        preview: (
          <span style={{ fontSize: sizes[level], fontWeight: 600 }}>Heading {level}</span>
        ),
      });
    }
  }

  return options;
}

function TextStyleToolbarItem() {
  const { schema } = useEditor();
  const editorState = useEditorState();
  const options = buildOptions(schema, editorState);
  const active = options.find((opt) => opt.isActive);
  const label = active?.shortLabel ?? "Text style";

  return (
    <Dropdown label={label} title="Text style" triggerStyle={{ minWidth: 110 }}>
      {options.map((opt) => (
        <DropdownItem key={opt.id} command={opt.command} active={opt.isActive}>
          {opt.preview}
        </DropdownItem>
      ))}
    </Dropdown>
  );
}

export const TextStyle = Extension.create({
  name: "text-style",
  commands: {
    paragraph: (schema) => setBlockType(schema.nodes["paragraph"]!),
  },
  keymap: { "Mod-Alt-0": "paragraph" },
  toolbar: TextStyleToolbarItem,
  meta: { label: "Text style", group: "block" },
});
