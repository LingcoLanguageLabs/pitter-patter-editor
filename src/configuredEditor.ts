import type { Schema } from "prosemirror-model";

import { createEditor } from "./editor";
import {
  Bold,
  BulletList,
  Callout,
  CharacterCount,
  Code,
  CodeBlock,
  Details,
  Dropcursor,
  Emoji,
  Focus,
  FontFamily,
  FontSize,
  Footnote,
  Gapcursor,
  HardBreak,
  Heading,
  Highlight,
  HorizontalRule,
  Image,
  Italic,
  LineHeight,
  Link,
  LinkCard,
  ListItem,
  Lists,
  Math,
  Mention,
  OrderedList,
  Placeholder,
  Quote,
  Redo,
  Separator,
  SlashMenu,
  Strike,
  StripFormatting,
  Subscript,
  Superscript,
  Table,
  TableOfContents,
  TaskList,
  TrailingNode,
  TextAlign,
  TextColor,
  TextDirection,
  TextStyle,
  Typography,
  Underline,
  Undo,
  UniqueID,
  YouTube,
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
  Callout,
  Separator,
  Bold,
  Italic,
  Strike,
  Code,
  Underline,
  Separator,
  FontFamily,
  FontSize,
  TextColor,
  Highlight,
  Link,
  Separator,
  Superscript,
  Subscript,
  StripFormatting,
  Separator,
  TextAlign,
  TextDirection,
  LineHeight,
  Separator,
  HorizontalRule,
  HardBreak,
  Table,
  Image,
  YouTube,
  LinkCard,
  Math,
  Footnote,
  Typography,
  Gapcursor,
  Dropcursor,
  Placeholder,
  TrailingNode,
  CharacterCount,
  Focus,
  UniqueID,
  TableOfContents,
  SlashMenu,
  Mention,
  Emoji,
] as const);

export type EditorCommand = Parameters<typeof editor.useRunCommand>[0];

export function buildInitialDoc(schema: Schema) {
  // Helpers that close over the schema. Saves a lot of repetition.
  const node = (name: string, attrs: Record<string, unknown> | null, content?: unknown) =>
    schema.nodes[name]!.create(attrs, content as never);
  const text = (value: string, marks: ReturnType<Schema["mark"]>[] = []) =>
    schema.text(value, marks.length ? marks : undefined);
  const mark = (name: string, attrs: Record<string, unknown> = {}) =>
    schema.marks[name]!.create(attrs);

  const para = (...content: unknown[]) => node("paragraph", null, content);
  const h = (level: number, value: string) =>
    node("heading", { level }, schema.text(value));
  const li = (value: string) =>
    node("list_item", null, node("paragraph", null, schema.text(value)));
  const taskItem = (checked: boolean, value: string) =>
    node(
      "task_item",
      { checked },
      node("paragraph", null, schema.text(value)),
    );

  // Inline marks
  const bold = mark("strong");
  const italic = mark("em");
  const code = mark("code");
  const highlight = mark("highlight");
  const link = (href: string) => mark("link", { href });

  return node("doc", null, [
    h(1, "Welcome to Pitter Patter"),
    para(
      text("Pitter Patter is a "),
      text("rich-text editor", [bold]),
      text(" built on "),
      text("ProseMirror", [link("https://prosemirror.net")]),
      text(" with React. Everything you see here is part of the toolbar above — try selecting, typing, or clicking around. Press "),
      text("/", [code]),
      text(" anywhere to open the slash menu."),
    ),

    node(
      "callout",
      { variant: "tip" },
      para(
        text("New here? Highlights, links, footnotes, math, and embedded media are all live in this document. Click any element to edit it."),
      ),
    ),

    h(2, "Inline formatting"),
    para(
      text("Mix marks freely: "),
      text("bold", [bold]),
      text(", "),
      text("italic", [italic]),
      text(", "),
      text("code", [code]),
      text(", "),
      text("highlight", [highlight]),
      text(", and "),
      text("links", [link("https://example.com")]),
      text(" all compose. Footnotes anchor to the bottom of the doc"),
      schema.nodes["footnote_reference"]!.create({
        "data-id": "demo-fn-1",
        referenceNumber: "",
      }),
      text(" — click them to jump. Try the "),
      schema.nodes["inline_math"]!.create({ latex: "e^{i\\pi} + 1 = 0" }),
      text(" inline math node — click it to edit."),
    ),

    h(2, "Lists & structure"),
    para(text("Bulleted, ordered, and task lists all support nesting and lifting:")),
    node("bullet_list", null, [
      li("Type 1. inside any bullet to switch to ordered"),
      li("Press Enter twice on an empty item to lift out"),
      li("Tab / Shift-Tab to nest"),
    ]),
    node("task_list", null, [
      taskItem(true, "Set up Storybook"),
      taskItem(true, "Drop in 19 extensions"),
      taskItem(false, "Wire collab from the sibling workspace"),
    ]),
    node(
      "blockquote",
      null,
      para(
        text("The pleasure of the editor is the small affordances — every keystroke matters."),
      ),
    ),
    node(
      "code_block",
      null,
      schema.text(
        `// A code block, plain monospace\nconst hello = (name: string) => \`Hi, \${name}!\`;`,
      ),
    ),

    node(
      "details",
      { open: false },
      [
        node("details_summary", null, schema.text("Click to expand")),
        node(
          "details_content",
          null,
          para(text("Details / collapse blocks fold their content. Useful for FAQs, asides, and hidden notes.")),
        ),
      ],
    ),

    h(2, "Rich content"),
    node(
      "callout",
      { variant: "info" },
      para(
        text("Anything that quacks like a block can live here — images, embeds, link previews, math."),
      ),
    ),
    para(
      node("image", {
        src: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&auto=format&fit=crop",
        alt: "Code on a screen",
      }),
    ),
    para(
      text("Below is a live YouTube embed — paste any YouTube URL on its own line and it auto-converts. Same for arbitrary links into a "),
      text("link card", [bold]),
      text("."),
    ),
    node("youtube", {
      src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
      width: 640,
      height: 360,
    }),
    node("link_card", {
      url: "https://prosemirror.net/",
      title: "ProseMirror — A toolkit for building rich-text editors",
      description:
        "ProseMirror is a well-behaved rich semantic content editor based on contentEditable, with support for collaborative editing and custom document schemas.",
      image: "",
      siteName: "prosemirror.net",
      loaded: true,
    }),

    h(2, "Math"),
    para(
      text("Inline math like "),
      schema.nodes["inline_math"]!.create({ latex: "a^2 + b^2 = c^2" }),
      text(" sits next to text. Block math gets its own line:"),
    ),
    node("block_math", { latex: "\\int_a^b x^2 \\, dx = \\frac{b^3 - a^3}{3}" }),

    h(2, "Tables"),
    node("table", null, [
      node("table_row", null, [
        node("table_header", null, para(text("Feature"))),
        node("table_header", null, para(text("Status"))),
        node("table_header", null, para(text("Notes"))),
      ]),
      node("table_row", null, [
        node("table_cell", null, para(text("Footnotes"))),
        node("table_cell", null, para(text("✓"))),
        node("table_cell", null, para(text("Auto-renumbered, per-doc"))),
      ]),
      node("table_row", null, [
        node("table_cell", null, para(text("Math"))),
        node("table_cell", null, para(text("✓"))),
        node("table_cell", null, para(text("KaTeX, edit in place"))),
      ]),
      node("table_row", null, [
        node("table_cell", null, para(text("Drag & drop"))),
        node("table_cell", null, para(text("✓"))),
        node("table_cell", null, para(text("via @pitter-patter/shuffle"))),
      ]),
    ]),

    node(
      "callout",
      { variant: "warning" },
      para(
        text("This is a demo doc. Pasting URLs, dragging blocks, and slash commands all work — explore freely. Footnote references"),
        schema.nodes["footnote_reference"]!.create({
          "data-id": "demo-fn-2",
          referenceNumber: "",
        }),
        text(" auto-renumber as you add or remove them."),
      ),
    ),

    para(text("Try it out. Everything is editable.")),

    // Footnote entries — the plugin's view() hook will renumber and rebuild
    // on mount to match the references above.
    node("footnotes", null, [
      node(
        "footnote",
        { "data-id": "demo-fn-1", id: "fn:1" },
        para(text("Footnotes are powered by a 3-node schema (reference, item, list) with auto-renumbering on every transaction.")),
      ),
      node(
        "footnote",
        { "data-id": "demo-fn-2", id: "fn:2" },
        para(text("Click any footnote in the body to jump down here; click an entry's number to jump back up.")),
      ),
    ]),
  ]);
}
