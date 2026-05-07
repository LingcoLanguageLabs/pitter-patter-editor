import type { Schema } from "prosemirror-model";

import { makeDocHelpers } from "./helpers";

/**
 * The primary demo doc — a narrative tour through every visible
 * extension. Each section introduces a small group; the goal is for a
 * first-time visitor to discover the editor's full surface area without
 * having to dig through Storybook stories.
 */
export function buildInitialDoc(schema: Schema) {
  const { node, text, mark, para, h, li, taskItem } = makeDocHelpers(schema);

  const bold = mark("strong");
  const italic = mark("em");
  const code = mark("code");
  const underline = mark("underline");
  const strike = mark("strike");
  const highlight = mark("highlight");
  const sup = mark("superscript");
  const sub = mark("subscript");
  const kbd = mark("kbd");
  const link = (href: string) => mark("link", { href });

  return node("doc", null, [
    // ────────────────────────────────────────────────── Hero
    h(1, "Pitter Patter — a tour"),
    para(
      text("Pitter Patter is a "),
      text("modular rich-text editor", [bold]),
      text(" built on "),
      text("ProseMirror", [link("https://prosemirror.net")]),
      text(". Everything in this doc is wired through the toolbar above. Press "),
      text("/", [code]),
      text(" anywhere to open the slash menu, or just start typing."),
    ),
    node(
      "callout",
      { variant: "tip" },
      para(
        text("Try selecting some text — a "),
        text("bubble menu", [bold]),
        text(" appears. Hover any link for a popover. Type a "),
        text("URL", [code]),
        text(" followed by a space and it auto-links."),
      ),
    ),

    // ────────────────────────────────────────────────── Inline marks
    h(2, "Inline marks"),
    para(
      text("Compose marks freely: "),
      text("bold", [bold]),
      text(", "),
      text("italic", [italic]),
      text(", "),
      text("underline", [underline]),
      text(", "),
      text("strike", [strike]),
      text(", "),
      text("code", [code]),
      text(", "),
      text("highlight", [highlight]),
      text(", "),
      text("links", [link("https://example.com")]),
      text(". Press "),
      text("Cmd+K", [kbd]),
      text(" to open the link picker. Subscript and superscript work too — H"),
      text("2", [sub]),
      text("O, E = mc"),
      text("2", [sup]),
      text("."),
    ),

    // ────────────────────────────────────────────────── Block structure
    h(2, "Lists, tasks, and structure"),
    para(text("Three list types — bulleted, ordered, and tasks — all support nesting and lifting:")),
    node("bullet_list", null, [
      li("Type \"1. \" inside any bullet to switch to ordered"),
      li("Press Enter twice on an empty item to lift out"),
      li("Tab / Shift-Tab to nest"),
    ]),
    node("task_list", null, [
      taskItem(true, "Compose extensions à la carte"),
      taskItem(true, "Drop in a toolbar, bubble menu, or slash menu"),
      taskItem(false, "Wire collaboration from your own backend"),
    ]),
    node(
      "blockquote",
      null,
      para(text("A regular blockquote — for indented asides and quoted text.")),
    ),
    node(
      "pull_quote",
      null,
      para(
        text("And a "),
        text("pull quote", [bold]),
        text(" — typographically distinct, for the line that's worth pulling out."),
      ),
    ),
    node(
      "code_block",
      null,
      schema.text(
        `// Code blocks render as plain monospace.\nconst hello = (name: string) => \`Hi, \${name}!\`;`,
      ),
    ),

    // ────────────────────────────────────────────────── Definition list
    h(3, "Definition list"),
    node("definition_list", null, [
      node("definition_term", null, schema.text("Schema")),
      node(
        "definition_description",
        null,
        para(
          text("Every node and mark Pitter Patter knows about. Extensions contribute to it; "),
          text("createEditor", [code]),
          text(" composes the result."),
        ),
      ),
      node("definition_term", null, schema.text("Extension")),
      node(
        "definition_description",
        null,
        para(text("A single object describing nodes, marks, plugins, commands, keymap, and toolbar UI.")),
      ),
    ]),

    // ────────────────────────────────────────────────── Callouts + Details
    h(2, "Callouts and disclosure"),
    node(
      "callout",
      { variant: "info" },
      para(text("Callouts come in four variants: tip, info, warning, and danger. Click the icon to swap.")),
    ),
    node(
      "details",
      { open: false },
      [
        node("details_summary", null, schema.text("Click to expand: keyboard shortcuts")),
        node(
          "details_content",
          null,
          [
            para(
              text("Cmd+B", [kbd]),
              text(" / "),
              text("Cmd+I", [kbd]),
              text(" — bold / italic"),
            ),
            para(
              text("Cmd+K", [kbd]),
              text(" — link"),
            ),
            para(
              text("Cmd+Z", [kbd]),
              text(" / "),
              text("Cmd+Shift+Z", [kbd]),
              text(" — undo / redo"),
            ),
          ],
        ),
      ],
    ),

    // ────────────────────────────────────────────────── Productivity
    h(2, "Productivity"),
    para(
      text("Insert "),
      schema.nodes["variable"]!.create({ name: "customer_name", defaultValue: "Friend" }),
      text(" anywhere to template a doc — variables render as chips and remember a default. Or drop a date pill: "),
      schema.nodes["date"]!.create({ value: "2026-05-07" }),
      text(". Bookmark a spot with an "),
      text("anchor", [bold]),
      text(": "),
      schema.nodes["anchor"]!.create({ id: "tour-productivity" }),
      text(" — link to it from anywhere with #tour-productivity."),
    ),
    para(
      text("Footnotes auto-renumber"),
      schema.nodes["footnote_reference"]!.create({
        "data-id": "demo-fn-1",
        referenceNumber: "",
      }),
      text(", and "),
      text("@", [code]),
      text(" opens the mention picker. Type "),
      text(":smile", [code]),
      text(" for emoji."),
    ),

    // ────────────────────────────────────────────────── Math
    h(2, "Math"),
    para(
      text("Inline math like "),
      schema.nodes["inline_math"]!.create({ latex: "e^{i\\pi} + 1 = 0" }),
      text(" sits next to text — click to edit. Block math gets its own line:"),
    ),
    node("block_math", { latex: "\\int_a^b x^2 \\, dx = \\frac{b^3 - a^3}{3}" }),

    // ────────────────────────────────────────────────── Media
    h(2, "Media"),
    para(text("Images drop in via paste, drag, or the toolbar. Click any image to align (left / center / right) or resize via the corner handles:")),
    node("image", {
      src: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&auto=format&fit=crop",
      alt: "Code on a screen",
      width: "75%",
      align: "center",
    }),
    para(
      text("Paste any YouTube URL on its own line and it auto-converts to an embed:"),
    ),
    node("youtube", {
      src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
      width: 640,
      height: 360,
    }),
    para(text("Audio and video have their own embeds — each is a real HTML element, controls and all. Link cards unfurl any URL:")),
    node("link_card", {
      url: "https://prosemirror.net/",
      title: "ProseMirror — A toolkit for building rich-text editors",
      description:
        "ProseMirror is a well-behaved rich semantic content editor based on contentEditable, with support for collaborative editing and custom document schemas.",
      image: "",
      siteName: "prosemirror.net",
      loaded: true,
    }),

    // ────────────────────────────────────────────────── Tables
    h(2, "Tables"),
    node("table", null, [
      node("table_row", null, [
        node("table_header", null, para(text("Surface"))),
        node("table_header", null, para(text("Trigger"))),
        node("table_header", null, para(text("What it does"))),
      ]),
      node("table_row", null, [
        node("table_cell", null, para(text("Slash menu"))),
        node("table_cell", null, para(text("/", [code]))),
        node("table_cell", null, para(text("Insert any block — derived from the schema."))),
      ]),
      node("table_row", null, [
        node("table_cell", null, para(text("Mention"))),
        node("table_cell", null, para(text("@", [code]))),
        node("table_cell", null, para(text("Pluggable item source — wire your own."))),
      ]),
      node("table_row", null, [
        node("table_cell", null, para(text("Emoji"))),
        node("table_cell", null, para(text(":", [code]))),
        node("table_cell", null, para(text("Inserts unicode characters."))),
      ]),
      node("table_row", null, [
        node("table_cell", null, para(text("Bubble menu"))),
        node("table_cell", null, para(text("(text selection)"))),
        node("table_cell", null, para(text("Mark toggles right next to the caret."))),
      ]),
    ]),

    node(
      "callout",
      { variant: "warning" },
      para(
        text("This doc is editable. Drop blocks anywhere, paste from Word or Google Docs (Smart Paste cleans it up), drag rows around with "),
        text("@pitter-patter/shuffle", [code]),
        text("."),
      ),
    ),

    // Footnotes pane — the plugin's view() hook renumbers and rebuilds
    // on mount to match the references above.
    node("footnotes", null, [
      node(
        "footnote",
        { "data-id": "demo-fn-1", id: "fn:1" },
        para(text("Footnotes are a 3-node schema (reference, item, list) with auto-renumbering on every transaction.")),
      ),
    ]),
  ]);
}
