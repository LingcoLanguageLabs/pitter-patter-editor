import type { Schema } from "prosemirror-model";

import { makeDocHelpers } from "./helpers";

// ─────────────────────────────────────────── AI Toolkit

export function buildAiDoc(schema: Schema) {
  const { node, text, mark, para, h, li } = makeDocHelpers(schema);
  const bold = mark("strong");
  const italic = mark("em");

  return node("doc", null, [
    h(1, "AI Toolkit"),
    para(
      text("This document demonstrates the AI dock at the bottom of the editor. "),
      text("Select any text and click ✨ to rephrase, shorten, fix grammar, "),
      text("translate, or write a freeform instruction."),
    ),

    node(
      "callout",
      { variant: "tip" },
      para(
        text("Try the "),
        text("Proofread", [bold]),
        text(" preset to run a structured-edit pass — the model returns one "),
        text("suggestion per block, navigable with arrow keys, accept/reject "),
        text("each independently."),
      ),
    ),

    h(2, "A draft paragraph"),
    para(
      text(
        "this is a paragraph that has lots of issues. its got grammer problems, awkward phrasing, and at least one typo. you can use the ai dock to fix it up. select the whole thing first, then hit Fix grammar — or write a custom instruction like make this more professional.",
      ),
    ),

    h(2, "Available presets"),
    node("bullet_list", null, [
      li("Rephrase — keep meaning, change wording"),
      li("Shorten — trim 30–50%"),
      li("Extend — add a sentence or two"),
      li("Fix grammar — spelling, grammar, punctuation"),
      li("Summarize — one short paragraph"),
      li("TL;DR — one sentence"),
      li("Tone (formal / casual)"),
      li("Translate — supply a target language"),
    ]),

    h(2, "Schema-aware"),
    para(
      text("The AI knows about every node and mark you've installed. Ask "),
      text('"add a callout warning about deprecation"', [italic]),
      text(" and it'll emit a real callout block, not just text styled to look like one."),
    ),
  ]);
}

// ─────────────────────────────────────────── Inserts (slash, mention, emoji)

export function buildInsertsDoc(schema: Schema) {
  const { node, text, mark, para, h } = makeDocHelpers(schema);
  const code = mark("code");

  return node("doc", null, [
    h(1, "Inserts"),
    para(
      text("Three trigger characters cover the bulk of insert UX:"),
    ),
    node("bullet_list", null, [
      node(
        "list_item",
        null,
        para(
          text("/", [code]),
          text(" opens the slash menu — every block type the schema knows about, fuzzy-searchable."),
        ),
      ),
      node(
        "list_item",
        null,
        para(
          text("@", [code]),
          text(" opens mention typeahead — pick a teammate, get a chip with a stable id."),
        ),
      ),
      node(
        "list_item",
        null,
        para(
          text(":", [code]),
          text(" opens the emoji picker — type a name and the unicode glyph drops in."),
        ),
      ),
    ]),

    h(2, "Try it here"),
    para(
      text("Place the cursor at the end of any line and try "),
      text("/heading", [code]),
      text(", "),
      text("/image", [code]),
      text(", "),
      text("/math", [code]),
      text(". Or "),
      text("@al", [code]),
      text(" to mention "),
      schema.nodes["mention"]!.create({ id: "alex", label: "Alex" }),
      text(", or "),
      text(":fire", [code]),
      text(" for a quick "),
      schema.nodes["emoji"]
        ? schema.nodes["emoji"]!.create({ shortcode: "fire", char: "🔥" })
        : text("🔥"),
      text("."),
    ),

    para(
      text(
        "These triggers compose: insert a callout via slash, drop a mention inside it, and end with an emoji.",
      ),
    ),
  ]);
}

// ─────────────────────────────────────────── Media

export function buildMediaDoc(schema: Schema) {
  const { node, text, mark, para, h, li } = makeDocHelpers(schema);
  const code = mark("code");

  return node("doc", null, [
    h(1, "Media"),
    para(
      text(
        "The editor handles five kinds of embedded media — each with its own bubble menu, drag-and-drop, paste-to-upload, and (for images) a right-click context menu.",
      ),
    ),

    h(2, "Image with bubble menu"),
    para(
      text(
        "Click any image to reveal the bubble menu: alt text + AI generation, alignment, width slider, delete. Right-click for the context menu (Copy URL, Edit alt, Generate alt, Delete). Shift-drag the side handle to snap width to 25/50/75/100%.",
      ),
    ),
    schema.nodes["image"]!.create({
      src: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=900",
      alt: "A mountain lake at sunrise",
      title: "Photo by Pietro De Grandi on Unsplash",
      width: "75%",
      align: "center",
    }),

    h(2, "Unsplash picker"),
    para(
      text("Click "),
      text("Add → Unsplash", [code]),
      text(" in the toolbar to search the Unsplash library inline. Photos arrive with proper attribution baked into the title attribute."),
    ),

    h(2, "YouTube embed"),
    schema.nodes["youtube"]!.create({
      src: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    }),

    h(2, "Video"),
    schema.nodes["video"]!.create({
      src: "https://www.w3schools.com/html/mov_bbb.mp4",
      controls: true,
    }),

    h(2, "Audio"),
    schema.nodes["audio"]!.create({
      src: "https://www.w3schools.com/html/horse.mp3",
      controls: true,
    }),

    h(2, "Drag, drop, paste"),
    node("bullet_list", null, [
      li("Drop an image file anywhere in the doc — it uploads via your supplied callback."),
      li("Paste an image from the clipboard — same path."),
      li("Paste a YouTube URL — auto-converts to the embed."),
    ]),
  ]);
}

// ─────────────────────────────────────────── Tables

export function buildTablesDoc(schema: Schema) {
  const { node, text, mark, para, h } = makeDocHelpers(schema);
  const bold = mark("strong");

  return node("doc", null, [
    h(1, "Tables"),
    para(
      text(
        "Click any cell to reveal the table bubble menu — add/remove rows and columns, toggle headers, merge/split cells, delete the whole table. Drag column borders to resize.",
      ),
    ),

    h(2, "Quarterly results"),
    node("table", null, [
      node("table_row", null, [
        node("table_header", null, para(text("Quarter", [bold]))),
        node("table_header", null, para(text("Revenue", [bold]))),
        node("table_header", null, para(text("Growth", [bold]))),
        node("table_header", null, para(text("Notes", [bold]))),
      ]),
      node("table_row", null, [
        node("table_cell", null, para(text("Q1"))),
        node("table_cell", null, para(text("$1.2M"))),
        node("table_cell", null, para(text("+12%"))),
        node("table_cell", null, para(text("Strong start"))),
      ]),
      node("table_row", null, [
        node("table_cell", null, para(text("Q2"))),
        node("table_cell", null, para(text("$1.4M"))),
        node("table_cell", null, para(text("+17%"))),
        node("table_cell", null, para(text("Beat plan"))),
      ]),
      node("table_row", null, [
        node("table_cell", null, para(text("Q3"))),
        node("table_cell", null, para(text("$1.5M"))),
        node("table_cell", null, para(text("+7%"))),
        node("table_cell", null, para(text("Slowed seasonally"))),
      ]),
      node("table_row", null, [
        node("table_cell", null, para(text("Q4"))),
        node("table_cell", null, para(text("$1.9M"))),
        node("table_cell", null, para(text("+27%"))),
        node("table_cell", null, para(text("Holiday push"))),
      ]),
    ]),

    h(2, "Tips"),
    para(
      text(
        "Selection works across rows and columns — drag from one cell into another to multi-select. Tab moves between cells; Shift-Tab goes back. The bubble menu commands operate on the current selection.",
      ),
    ),
  ]);
}

// ─────────────────────────────────────────── Links & cards

export function buildLinksDoc(schema: Schema) {
  const { node, text, mark, para, h } = makeDocHelpers(schema);
  const link = (href: string) => mark("link", { href });

  return node("doc", null, [
    h(1, "Links & cards"),
    para(
      text("The editor has three link surfaces, each with a different feel:"),
    ),

    h(2, "Inline links"),
    para(
      text("Plain inline links live as marks. Hover any link to reveal a popover with the URL plus open/edit/copy/unlink. Try this one: "),
      text("ProseMirror docs", [link("https://prosemirror.net/docs/")]),
      text(". The popover follows the link and dismisses when you click away."),
    ),

    h(2, "Auto-linkify"),
    para(
      text(
        "Type a bare URL like https://example.com and it auto-becomes a real link as you type a space after it. No need to use the toolbar.",
      ),
    ),

    h(2, "Link cards"),
    para(
      text(
        "Paste a URL on its own line and the editor converts it into a rich card with title, description, and favicon — fetched from the URL's open-graph metadata.",
      ),
    ),
    schema.nodes["link_card"]!.create({
      href: "https://prosemirror.net/",
      title: "ProseMirror",
      description:
        "A toolkit for building rich-text editors on the web. Battle-tested schema-driven model with first-class collaborative editing.",
      favicon: "https://prosemirror.net/css/icon.png",
      siteName: "prosemirror.net",
    }),
    para(
      text(
        "Click the card to open the link in a new tab. Right-click (or hover for the link bubble) to convert it back into a plain inline link.",
      ),
    ),
  ]);
}

// ─────────────────────────────────────────── Math & Footnotes

export function buildMathFootnotesDoc(schema: Schema) {
  const { node, text, mark, para, h } = makeDocHelpers(schema);
  const italic = mark("em");
  const bold = mark("strong");

  return node("doc", null, [
    h(1, "Math & footnotes"),
    para(
      text("Two scientific-writing primitives that compose with everything else:"),
    ),

    h(2, "Inline math"),
    para(
      text("Wrap math in $...$ — Pythagoras becomes "),
      schema.nodes["inline_math"]!.create({ latex: "a^2 + b^2 = c^2" }),
      text(", and Euler's identity is "),
      schema.nodes["inline_math"]!.create({ latex: "e^{i\\pi} + 1 = 0" }),
      text(". Click any math chip to edit the LaTeX in a popover."),
    ),

    para(
      text("More involved expressions: the heat equation "),
      schema.nodes["inline_math"]!.create({
        latex: "\\frac{\\partial u}{\\partial t} = \\alpha \\nabla^2 u",
      }),
      text(", the standard normal density "),
      schema.nodes["inline_math"]!.create({
        latex: "f(x) = \\frac{1}{\\sqrt{2\\pi}} e^{-x^2/2}",
      }),
      text("."),
    ),

    h(2, "Footnotes"),
    para(
      text("Type "),
      text("[^anything]", [italic]),
      text(" to drop a footnote reference"),
      schema.nodes["footnote_reference"]!.create({
        "data-id": "fn-pf",
        referenceNumber: "",
      }),
      text(". The footnotes list at the bottom of the document is auto-numbered and stays in sync as you reorder, copy, or delete references."),
    ),

    para(
      text(
        "Click a reference to jump to its footnote and back. Footnotes can themselves contain inline marks",
      ),
      schema.nodes["footnote_reference"]!.create({
        "data-id": "fn-marks",
        referenceNumber: "",
      }),
      text(" — bold, italic, links, math — anything paragraph-level."),
    ),

    h(2, "Together"),
    para(
      text("This makes the editor a respectable home for "),
      text("technical writing", [bold]),
      text(": equations live inline with prose, citations and asides drop into footnotes, and the whole document reads top-to-bottom without context switching."),
    ),

    node("footnotes", null, [
      node(
        "footnote",
        { "data-id": "fn-pf", id: "fn:1" },
        para(
          text("Footnote references are inline atoms. They preserve identity across copy/paste — pasting one twice creates a second numbered footnote, not a duplicate."),
        ),
      ),
      node(
        "footnote",
        { "data-id": "fn-marks", id: "fn:2" },
        para(
          text("Footnote bodies use the same paragraph schema as the main flow, so any inline content works inside them."),
        ),
      ),
    ]),
  ]);
}

// ─────────────────────────────────────────── Block primitives

export function buildBlockPrimitivesDoc(schema: Schema) {
  const { node, text, mark, para, h, li, taskItem } = makeDocHelpers(schema);
  const bold = mark("strong");
  const code = mark("code");
  const kbd = mark("kbd");

  return node("doc", null, [
    h(1, "Block primitives"),
    para(
      text(
        "A tour of the structural blocks the editor ships with. Each one has its own toolbar entry, slash-menu shortcut, and (where it makes sense) a markdown input rule.",
      ),
    ),

    h(2, "Callouts"),
    node(
      "callout",
      { variant: "info" },
      para(text("Info — context the reader should keep in mind.")),
    ),
    node(
      "callout",
      { variant: "tip" },
      para(text("Tip — a small recommendation that improves the experience.")),
    ),
    node(
      "callout",
      { variant: "warning" },
      para(text("Warning — something to be aware of before proceeding.")),
    ),
    node(
      "callout",
      { variant: "danger" },
      para(text("Danger — irreversible or destructive.")),
    ),

    h(2, "Details / Disclosure"),
    node("details", { open: true }, [
      node("details_summary", null, schema.text("Click to collapse")),
      node(
        "details_content",
        null,
        para(
          text(
            "Hidden content lives inside details blocks. The summary is always visible; the body collapses on toggle. Useful for FAQs, optional context, and long-form expandable sections.",
          ),
        ),
      ),
    ]),

    h(2, "Definition list"),
    node("definition_list", null, [
      node("definition_term", null, schema.text("Schema")),
      node(
        "definition_description",
        null,
        para(text("The set of node and mark types the editor understands.")),
      ),
      node("definition_term", null, schema.text("Mark")),
      node(
        "definition_description",
        null,
        para(text("Inline annotation on text — bold, italic, link, code, kbd.")),
      ),
      node("definition_term", null, schema.text("Decoration")),
      node(
        "definition_description",
        null,
        para(text("Visual layer attached to positions in the doc — never modifies the doc itself.")),
      ),
    ]),

    h(2, "Quote vs pull-quote"),
    node(
      "blockquote",
      null,
      para(
        text(
          "A standard blockquote: a note from somewhere else, indented, fits the flow.",
        ),
      ),
    ),
    node(
      "pull_quote",
      null,
      para(
        text(
          "A pull-quote pulls a sentence out of the body and amplifies it visually — bigger, often centered, used to draw attention.",
        ),
      ),
    ),

    h(2, "Code"),
    para(
      text("Inline code: "),
      text("editor.chain().focus().run()", [code]),
      text(". A code block:"),
    ),
    node(
      "code_block",
      { language: "ts" },
      schema.text(
        'const editor = createEditor([Bold, Italic, Link]);\neditor.chain()\n  .focus()\n  .toggleBold()\n  .run();',
      ),
    ),

    h(2, "Keyboard shortcuts"),
    para(
      text("Use "),
      text("Cmd", [kbd]),
      text(" + "),
      text("B", [kbd]),
      text(" for bold, "),
      text("Cmd", [kbd]),
      text(" + "),
      text("Shift", [kbd]),
      text(" + "),
      text("L", [kbd]),
      text(" for a list."),
    ),

    h(2, "Lists"),
    para(text("Bulleted:")),
    node("bullet_list", null, [
      li("Plain bullets"),
      li("Nest with Tab; outdent with Shift-Tab"),
      li("Backspace on empty bullet → paragraph"),
    ]),
    para(text("Ordered:")),
    node("ordered_list", null, [
      li("Auto-numbers"),
      li("Numbering rebases when items reorder"),
    ]),
    para(text("Task list:")),
    node("task_list", null, [
      taskItem(true, "Click checkboxes to toggle"),
      taskItem(false, "Nests like other lists"),
      taskItem(false, "Strikethrough on done is just CSS"),
    ]),

    h(2, "Horizontal rule"),
    para(
      text("Three dashes "),
      text("---", [code]),
      text(" on a line by themselves become a horizontal rule:"),
    ),
    schema.nodes["horizontal_rule"]!.create(),
    para(
      text(
        "Useful as a soft section break when a heading would be too heavy.",
      ),
    ),

    h(2, "Bold + italic + strike"),
    para(
      text("Inline marks compose. Try "),
      text("bold", [bold]),
      text(", "),
      text("italic", [mark("em")]),
      text(", "),
      text("struck through", [mark("strike")]),
      text(", "),
      text("highlighted", [mark("highlight", { color: "yellow" })]),
      text("."),
    ),
  ]);
}
