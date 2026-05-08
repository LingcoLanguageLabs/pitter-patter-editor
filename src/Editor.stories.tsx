import { ProseMirrorDoc } from "@handlewithcare/react-prosemirror";
import type { Schema } from "prosemirror-model";
import { schema as basicSchema } from "prosemirror-schema-basic";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { buildInitialDoc, editor, pagesEditor } from "./configuredEditor";
import { CollabEditor } from "./CollabEditor";
import { buildProductivityDoc } from "./demoDocs/productivity";
import {
  buildAiDoc,
  buildBlockPrimitivesDoc,
  buildInsertsDoc,
  buildLinksDoc,
  buildMathFootnotesDoc,
  buildMediaDoc,
  buildTablesDoc,
} from "./demoDocs/storyDemos";
import { DragDropEditor } from "./DragDropEditor";
import {
  AiDock,
  EmojiPopover,
  LinkHoverPopover,
  MathInlinePopover,
  MentionPopover,
  PageHeaderFooterEditor,
  SlashMenuPopover,
  TableOfContentsView,
  UnsplashPicker,
  VariableEditPopover,
} from "./editor/extensions";
import { BubbleMenu } from "./BubbleMenu";
import { ImageBubbleMenu } from "./ImageBubbleMenu";
import { ImageContextMenu } from "./ImageContextMenu";
import { StatsBar } from "./StatsBar";
import { TableBubbleMenu } from "./TableBubbleMenu";
import { Toolbar } from "./Toolbar";

/**
 * The full popover stack the editor exposes. Stories that mount the
 * configured editor reach for this so each one doesn't have to remember
 * which popovers go with which extensions.
 */
function EditorOverlays() {
  return (
    <>
      <TableBubbleMenu />
      <ImageBubbleMenu />
      <ImageContextMenu />
      <SlashMenuPopover />
      <MentionPopover />
      <EmojiPopover />
      <MathInlinePopover />
      <VariableEditPopover />
      <LinkHoverPopover />
      <AiDock />
      <UnsplashPicker />
    </>
  );
}

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
          <EditorOverlays />
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
          <EditorOverlays />
        </editor.Editor>
      </div>
    </div>
  ),
};

export const Productivity: Story = {
  name: "Productivity (variables, dates, anchors)",
  render: () => (
    <div className="editor-shell">
      <h2 className="editor-title">Productivity — template-style authoring</h2>
      <div className="editor-surface">
        <editor.Editor
          baseSchema={basicSchema}
          initialDoc={buildProductivityDoc}
        >
          <Toolbar />
          <ProseMirrorDoc />
          <EditorOverlays />
        </editor.Editor>
      </div>
    </div>
  ),
};

export const StatsPanel: Story = {
  name: "Stats panel",
  render: () => (
    <div className="editor-shell">
      <h2 className="editor-title">
        Stats panel — useStatistics() in a status bar
      </h2>
      <div className="editor-surface">
        <editor.Editor baseSchema={basicSchema} initialDoc={buildInitialDoc}>
          <Toolbar />
          <ProseMirrorDoc />
          <EditorOverlays />
          <StatsBar />
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

export const Collaboration: Story = {
  name: "Collaboration (multi-tab + comments + history)",
  render: () => (
    <div className="editor-shell editor-shell--collab">
      <h2 className="editor-title">
        Collaboration — open this story in two tabs · run <code>yarn dev:server</code> first
      </h2>
      <CollabEditor docId="demo" />
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

function buildPagesDoc(schema: Schema) {
  const h = (level: number, text: string) =>
    schema.nodes["heading"]!.create({ level }, schema.text(text));
  const p = (text: string) =>
    schema.nodes["paragraph"]!.create(null, schema.text(text));

  const filler = (n: number) =>
    Array.from({ length: n }, (_, i) =>
      p(
        `Filler paragraph ${i + 1}. ${"Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. ".repeat(2)}`,
      ),
    );

  return schema.nodes["doc"]!.create(null, [
    h(1, "A short paginated document"),
    p(
      "This story renders the editor in pagination mode. Type past the bottom of a page and a new one appears; delete content and the trailing pages disappear. Double-click any header or footer to edit it.",
    ),
    h(2, "First section"),
    ...filler(6),
    h(2, "Second section"),
    ...filler(8),
    h(2, "Third section"),
    ...filler(6),
  ]);
}

export const Pages: Story = {
  name: "Pages (Word-style pagination)",
  render: () => (
    <div className="editor-shell">
      <h2 className="editor-title">
        Pages — Letter / A4 / Legal · double-click a header or footer to edit
      </h2>
      <div className="editor-surface editor-surface--pages">
        <pagesEditor.Editor baseSchema={basicSchema} initialDoc={buildPagesDoc}>
          <Toolbar />
          <div className="editor-deck">
            <ProseMirrorDoc />
          </div>
          <PageHeaderFooterEditor />
          <SlashMenuPopover />
        </pagesEditor.Editor>
      </div>
    </div>
  ),
};

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
            <EditorOverlays />
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

// ─────────────────────────────────────────── Feature-focused stories

export const AiToolkit: Story = {
  name: "AI Toolkit",
  render: () => (
    <div className="editor-shell">
      <h2 className="editor-title">
        AI Toolkit — select text and open the dock at the bottom
      </h2>
      <div className="editor-surface">
        <editor.Editor baseSchema={basicSchema} initialDoc={buildAiDoc}>
          <Toolbar />
          <ProseMirrorDoc />
          <EditorOverlays />
        </editor.Editor>
      </div>
    </div>
  ),
};

export const Inserts: Story = {
  name: "Inserts (slash · mention · emoji)",
  render: () => (
    <div className="editor-shell">
      <h2 className="editor-title">
        Inserts — try <code>/</code>, <code>@</code>, and <code>:</code>
      </h2>
      <div className="editor-surface">
        <editor.Editor baseSchema={basicSchema} initialDoc={buildInsertsDoc}>
          <Toolbar />
          <ProseMirrorDoc />
          <EditorOverlays />
        </editor.Editor>
      </div>
    </div>
  ),
};

export const Media: Story = {
  name: "Media (image · video · audio · embeds)",
  render: () => (
    <div className="editor-shell">
      <h2 className="editor-title">
        Media — image bubble menu, right-click context, Unsplash, YouTube
      </h2>
      <div className="editor-surface">
        <editor.Editor baseSchema={basicSchema} initialDoc={buildMediaDoc}>
          <Toolbar />
          <ProseMirrorDoc />
          <EditorOverlays />
        </editor.Editor>
      </div>
    </div>
  ),
};

export const Tables: Story = {
  name: "Tables",
  render: () => (
    <div className="editor-shell">
      <h2 className="editor-title">
        Tables — click any cell to reveal the table bubble menu
      </h2>
      <div className="editor-surface">
        <editor.Editor baseSchema={basicSchema} initialDoc={buildTablesDoc}>
          <Toolbar />
          <ProseMirrorDoc />
          <EditorOverlays />
        </editor.Editor>
      </div>
    </div>
  ),
};

export const LinksAndCards: Story = {
  name: "Links & cards",
  render: () => (
    <div className="editor-shell">
      <h2 className="editor-title">
        Links — inline links, hover popover, auto-linkify, paste-as-card
      </h2>
      <div className="editor-surface">
        <editor.Editor baseSchema={basicSchema} initialDoc={buildLinksDoc}>
          <Toolbar />
          <ProseMirrorDoc />
          <EditorOverlays />
        </editor.Editor>
      </div>
    </div>
  ),
};

export const MathAndFootnotes: Story = {
  name: "Math & footnotes",
  render: () => (
    <div className="editor-shell">
      <h2 className="editor-title">
        Math & footnotes — KaTeX inline, references with auto-numbered list
      </h2>
      <div className="editor-surface">
        <editor.Editor
          baseSchema={basicSchema}
          initialDoc={buildMathFootnotesDoc}
        >
          <Toolbar />
          <ProseMirrorDoc />
          <EditorOverlays />
        </editor.Editor>
      </div>
    </div>
  ),
};

export const BlockPrimitives: Story = {
  name: "Block primitives",
  render: () => (
    <div className="editor-shell">
      <h2 className="editor-title">
        Block primitives — callouts, details, defs, quotes, code, lists
      </h2>
      <div className="editor-surface">
        <editor.Editor
          baseSchema={basicSchema}
          initialDoc={buildBlockPrimitivesDoc}
        >
          <Toolbar />
          <ProseMirrorDoc />
          <EditorOverlays />
        </editor.Editor>
      </div>
    </div>
  ),
};
