import type { Schema } from "prosemirror-model";

import { createEditor } from "./editor";
import {
  Bold,
  BulletList,
  Code,
  CodeBlock,
  Details,
  Emoji,
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
  OrderedList,
  Quote,
  Redo,
  Separator,
  SlashMenu,
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

export const editor = createEditor([
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

export function buildInitialDoc(schema: Schema) {
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
