import { ProseMirrorDoc } from "@handlewithcare/react-prosemirror";
import { schema as basicSchema } from "prosemirror-schema-basic";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { buildInitialDoc, editor } from "./configuredEditor";
import { DragDropEditor } from "./DragDropEditor";
import { EmojiPopover, MentionPopover, SlashMenuPopover } from "./editor/extensions";
import { BubbleMenu } from "./BubbleMenu";
import { ImageBubbleMenu } from "./ImageBubbleMenu";
import { TableBubbleMenu } from "./TableBubbleMenu";
import { Toolbar } from "./Toolbar";

const meta: Meta = {
  title: "Editor/Editor",
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj;

export const FixedToolbar: Story = {
  name: "Fixed Toolbar",
  render: () => (
    <div className="editor-shell">
      <h2 className="editor-title">Fixed Toolbar</h2>
      <div className="editor-surface">
        <editor.Editor baseSchema={basicSchema} initialDoc={buildInitialDoc}>
          <Toolbar />
          <ProseMirrorDoc />
          <TableBubbleMenu />
          <ImageBubbleMenu />
          <SlashMenuPopover />
          <MentionPopover />
          <EmojiPopover />
        </editor.Editor>
      </div>
    </div>
  ),
};

export const FloatingToolbar: Story = {
  name: "Floating Toolbar",
  render: () => (
    <div className="editor-shell">
      <h2 className="editor-title">Floating Toolbar — select text to reveal</h2>
      <div className="editor-surface">
        <editor.Editor baseSchema={basicSchema} initialDoc={buildInitialDoc}>
          <ProseMirrorDoc />
          <BubbleMenu />
          <TableBubbleMenu />
          <ImageBubbleMenu />
          <SlashMenuPopover />
          <MentionPopover />
          <EmojiPopover />
        </editor.Editor>
      </div>
    </div>
  ),
};

export const DragAndDrop: Story = {
  name: "Drag and Drop",
  render: () => (
    <div className="editor-shell">
      <h2 className="editor-title">Drag and Drop — grab a handle or block edge</h2>
      <div className="editor-surface editor-surface--shuffle">
        <DragDropEditor />
      </div>
    </div>
  ),
};
