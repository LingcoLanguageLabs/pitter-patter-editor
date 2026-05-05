import { ProseMirrorDoc } from "@handlewithcare/react-prosemirror";
import { schema as basicSchema } from "prosemirror-schema-basic";
import type { Schema } from "prosemirror-model";
import { createRoot } from "react-dom/client";

import { createEditor } from "./editor";
import {
  Bold,
  BulletList,
  Code,
  CodeBlock,
  Details,
  Emoji,
  EmojiPopover,
  HardBreak,
  Heading,
  Highlight,
  HorizontalRule,
  Image,
  Italic,
  Link,
  ListItem,
  Lists,
  Mention,
  MentionPopover,
  OrderedList,
  Quote,
  Redo,
  Separator,
  SlashMenu,
  SlashMenuPopover,
  Strike,
  Subscript,
  Superscript,
  Table,
  TaskList,
  TextAlign,
  TextColor,
  TextStyle,
  Typography,
  Underline,
  Undo,
} from "./editor/extensions";
import { BubbleMenu } from "./BubbleMenu";
import { ImageBubbleMenu } from "./ImageBubbleMenu";
import { TableBubbleMenu } from "./TableBubbleMenu";
import { Toolbar } from "./Toolbar";

import "prosemirror-view/style/prosemirror.css";
import "./styles.css";

const editor = createEditor([
  Undo,
  Redo,
  Separator,
  TextStyle,
  Heading,
  Lists,
  BulletList,
  OrderedList,
  ListItem,
  TaskList,
  Quote,
  CodeBlock,
  Details,
  Separator,
  Bold,
  Italic,
  Strike,
  Code,
  Underline,
  TextColor,
  Highlight,
  Link,
  Separator,
  Superscript,
  Subscript,
  Separator,
  TextAlign,
  Separator,
  HorizontalRule,
  HardBreak,
  Table,
  Image,
  Typography,
  SlashMenu,
  Mention,
  Emoji,
] as const);

export type EditorCommand = Parameters<typeof editor.useRunCommand>[0];

function buildInitialDoc(schema: Schema) {
  return schema.nodes["doc"]!.create(null, [
    schema.nodes["heading"]!.create({ level: 1 }, schema.text("Hello, Pitter Patter")),
    schema.nodes["paragraph"]!.create(null, [
      schema.text("Marks: "),
      schema.text("bold", [schema.marks["strong"]!.create()]),
      schema.text(", "),
      schema.text("highlighted", [schema.marks["highlight"]!.create()]),
      schema.text(", "),
      schema.text("link", [schema.marks["link"]!.create({ href: "https://example.com" })]),
      schema.text("."),
    ]),
    schema.nodes["bullet_list"]!.create(null, [
      schema.nodes["list_item"]!.create(
        null,
        schema.nodes["paragraph"]!.create(
          null,
          schema.text("Type 1. inside this bullet to switch to ordered."),
        ),
      ),
      schema.nodes["list_item"]!.create(
        null,
        schema.nodes["paragraph"]!.create(
          null,
          schema.text("Press Enter twice on an empty item to lift out."),
        ),
      ),
    ]),
    schema.nodes["paragraph"]!.create(null, [
      schema.text("Click the image button to insert one — try "),
      schema.text("https://picsum.photos/200", [schema.marks["code"]!.create()]),
      schema.text("."),
    ]),
  ]);
}

function App() {
  return (
    <div className="editor-shell">
      <h2 className="editor-title">Pitter Patter Editor</h2>
      <div className="editor-surface">
        <editor.Editor baseSchema={basicSchema} initialDoc={buildInitialDoc}>
          <Toolbar />
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
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");
createRoot(root).render(<App />);
