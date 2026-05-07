import { ProseMirrorDoc } from "@handlewithcare/react-prosemirror";
import type { Schema } from "prosemirror-model";
import { schema as basicSchema } from "prosemirror-schema-basic";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { buildInitialDoc, editor } from "./configuredEditor";
import { DragDropEditor } from "./DragDropEditor";
import {
  EmojiPopover,
  MathInlinePopover,
  MentionPopover,
  SlashMenuPopover,
  TableOfContentsView,
  VariableEditPopover,
} from "./editor/extensions";
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
          <MathInlinePopover />
          <VariableEditPopover />
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
          <MathInlinePopover />
          <VariableEditPopover />
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

function buildTocDoc(schema: Schema) {
  const h = (level: number, text: string) =>
    schema.nodes["heading"]!.create({ level }, schema.text(text));
  const p = (text: string) =>
    schema.nodes["paragraph"]!.create(null, schema.text(text));

  return schema.nodes["doc"]!.create(null, [
    h(1, "The evolution of editing"),
    p(
      "A short history of the rich-text editor — from punched cards to ProseMirror — and the design choices that have stuck.",
    ),

    h(2, "Origins"),
    p(
      "Before computers had screens, editing meant punching cards or feeding paper tape. The cursor was an imagined position; “verifying” a change meant printing the surrounding lines.",
    ),
    p(
      "Line editors gave us the first interactive feedback loop. ed in Unix is the canonical survivor — terse, exact, and somehow still in everyone's path.",
    ),

    h(2, "The desktop era"),
    p(
      "When terminals grew video screens, full-screen editors followed. The split between programmer-oriented (vi, Emacs) and writer-oriented (WordStar, then Word) was set early and rarely crossed.",
    ),

    h(3, "WYSIWYG"),
    p(
      "What-you-see-is-what-you-get arrived in 1974 with Bravo at PARC. The premise — that the screen should match the printed page — settled the writer-oriented branch for forty years.",
    ),

    h(3, "Plain-text holdouts"),
    p(
      "Programmers stuck with plain-text editors and added structure as needed. The format wars (RTF vs DOC vs everything-else) all happened on the WYSIWYG side.",
    ),

    h(2, "Web-native editing"),
    p(
      "In 2000 Microsoft shipped contentEditable in Internet Explorer 5.5. It was undocumented, inconsistent, and quickly indispensable.",
    ),

    h(3, "ContentEditable, the gift and curse"),
    p(
      "Every browser implemented contentEditable slightly differently. The same keystroke produced different DOM in Safari vs Firefox vs Chrome. The next decade of editor work was effectively normalization.",
    ),

    h(5, "An aside on selection APIs"),
    p(
      "This heading skips levels on purpose — it's an h5 nested directly under an h3. The TOC normalizes it back to depth four so the outline stays sensible.",
    ),

    h(3, "ProseMirror"),
    p(
      "Marijn Haverbeke's 2017 release was the inflection point. By treating the document as a typed transactional model and the DOM as a render target, ProseMirror sidestepped contentEditable's worst surprises.",
    ),
    p(
      "Schema-driven editing meant invariants you could prove instead of guess. Plugins composed cleanly. The DOM finally stopped being authoritative.",
    ),

    h(2, "What's next"),
    p(
      "AI-assisted writing, real-time collaboration, and structured documents that travel through pipelines without losing themselves. The editor stops being a place you type and becomes the operating surface for everything you write.",
    ),
    p(
      "The patterns from this article — schema, transactions, decorations — keep recurring. They're the parts worth taking forward.",
    ),
  ]);
}

export const TableOfContents: Story = {
  name: "Table of Contents",
  render: () => (
    <div className="editor-shell editor-shell--toc">
      <h2 className="editor-title">Table of Contents — click an entry or scroll the page</h2>
      <div className="editor-toc-grid">
        <editor.Editor baseSchema={basicSchema} initialDoc={buildTocDoc}>
          <div className="editor-toc-main editor-surface">
            <Toolbar />
            <ProseMirrorDoc />
            <BubbleMenu />
            <TableBubbleMenu />
            <ImageBubbleMenu />
            <SlashMenuPopover />
            <MentionPopover />
            <EmojiPopover />
          </div>
          <aside className="editor-toc-sidebar">
            <h3 className="editor-toc-heading">Table of contents</h3>
            <TableOfContentsView />
          </aside>
        </editor.Editor>
      </div>
    </div>
  ),
};
