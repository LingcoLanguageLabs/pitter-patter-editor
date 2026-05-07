# Pitter Patter Editor

A modular rich-text editor built on [ProseMirror](https://prosemirror.dev/) and React 19, using [`@handlewithcare/react-prosemirror`](https://github.com/handlewithcare/react-prosemirror) for the React bindings. Everything visible in the editor — every mark, node, keymap, toolbar button, slash menu, suggestion, and input rule — is contributed by an **extension**. There is no monolithic config; you compose an editor by passing a list of extensions to `createEditor`.

The architecture is intentionally close to ProseMirror primitives. There is no "framework layer" hiding the schema or plugin system — extensions return raw `NodeSpec` / `MarkSpec` / `Plugin` / `Command` values, and the editor wires them together.

<img width="1090" height="632" alt="image" src="https://github.com/user-attachments/assets/d530db90-b129-4f42-b7c8-636533633a8f" />

## Quick start

```bash
yarn install
yarn storybook    # open http://localhost:6006
yarn dev          # vite dev server (src/main.tsx)
yarn build        # tsc -b && vite build
```

The Storybook entry has the editor in five flavours — Fixed Toolbar, Floating Toolbar, Drag and Drop, Productivity (variables/dates/anchors), Stats panel, Table of Contents — plus the dev `index.html` mounts the same configured editor.

> Yarn PnP: this repo uses Yarn Plug'n'Play (`.pnp.cjs`, `.pnp.loader.mjs`). Use `yarn` rather than `npm`.

## What's in the box

Roughly seventy extensions covering the surface area you'd expect from a modern WYSIWYG editor. The full per-extension cheatsheet — schema, commands, keymap, options, companion components — lives in [`docs/EXTENSIONS.md`](docs/EXTENSIONS.md). High-level groupings:

- **Inline marks** — Bold, Italic, Strike, Code, Underline, Subscript, Superscript, Highlight, Link, Kbd, Language
- **Block nodes** — Heading, Quote, PullQuote, CodeBlock, BulletList, OrderedList, ListItem, Lists, TaskList, Callout, Details, DefinitionList, HorizontalRule, Footnote, HardBreak
- **Inline atoms** — Image (with resize + alignment), YouTube, Audio, Video, Math (KaTeX), Variables, Date, Anchor, Mention, Emoji
- **Tables** — Table (prosemirror-tables) + a cell bubble menu
- **Text styling (schema patches)** — TextStyle, TextAlign, TextColor, TextDirection, FontFamily, FontSize, LineHeight, UniqueID
- **Productivity & polish** — Typography, Placeholder, TrailingNode, Gapcursor, Dropcursor, CharacterCount, Statistics, Focus, MaintainSelection, ColorChip, SmartPaste, Linkify, HoverLink, FileHandler, ImageUpload, InvisibleCharacters, StripFormatting
- **Suggestion / surface** — SlashMenu, TableOfContents, LinkCard
- **Toolbar utilities** — Undo, Redo, Separator

A handful of extensions need a paired React component (popover, panel) rendered alongside `<editor.Editor>` — see [Companion components](#companion-components) below.

## Mental model

```
  ┌───────────────────────────────────────────────────────────┐
  │ createEditor([Bold, Heading, Lists, Image, …])            │ ← compose
  └─────────────────────────────┬─────────────────────────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          ▼                     ▼                     ▼
  ┌─────────────────────┐ ┌───────────────────┐ ┌───────────────────┐
  │ buildSchema         │ │ buildCommands     │ │ buildPlugins      │
  │  - marks/nodes      │ │  - factory(schema)│ │  - ext.plugins    │
  │  - patchNodes/Marks │ │    → Command      │ │  - inputRules     │
  └──────────┬──────────┘ └─────────┬─────────┘ │  - history        │
             │                      │           │  - keymap (undo)  │
             │                      │           │  - keymap (ext)   │
             │                      │           │  - baseKeymap     │
             │                      │           │  - reactKeys()    │
             │                      │           └─────────┬─────────┘
             └──────────────────────┼─────────────────────┘
                                    ▼
                <ProseMirror state dispatchTransaction>
                                    │
                                    ▼
          <Toolbar/>, <BubbleMenu/>, <SlashMenuPopover/>, etc.
```

Each extension is a single object with optional fields — most extensions only set a few of them.

## Authoring an extension

`src/editor/types.ts` defines the contract:

```ts
interface Extension<TCommandName extends string = string> {
  name: string;                                   // unique id, used for isActive lookup
  marks?: Record<string, MarkSpec>;               // contribute marks to the schema
  nodes?: Record<string, NodeSpec>;               // contribute nodes to the schema
  patchNodes?: Record<string, NodePatch>;         // wrap an existing node spec
  patchMarks?: Record<string, MarkPatch>;         // wrap an existing mark spec
  commands?: Record<TCommandName, CommandFactory>;// (schema) => Command
  keymap?: Record<string, TCommandName>;          // "Mod-b" → "bold"
  isActive?: IsActiveFn;                          // (state, schema) => boolean
  plugins?: PluginsFactory;                       // (schema) => Plugin[]
  inputRules?: InputRulesFactory;                 // (schema) => InputRule[]
  toolbar?: ComponentType;                        // React node rendered in <Toolbar/>
  meta?: ExtensionMeta;                           // label, shortcut, group, Icon
}
```

Always build extensions via `Extension.create({...})` — it preserves command-name typing so `keymap` values are checked against the keys of `commands` at the type level.

### Minimal mark example (`Bold`)

```tsx
import { toggleMark } from "prosemirror-commands";
import { schema as basicSchema } from "prosemirror-schema-basic";
import { Extension, isMarkActive, ToggleMarkItem } from "../";

const strongSpec = basicSchema.spec.marks.get("strong")!;

export const Bold = Extension.create({
  name: "bold",
  marks: { strong: strongSpec },
  commands: { bold: (schema) => toggleMark(schema.marks["strong"]!) },
  keymap: { "Mod-b": "bold", "Mod-B": "bold" },
  isActive: (state, schema) => isMarkActive(state, schema.marks["strong"]!),
  toolbar: () => {
    const { schema } = useEditor();
    return (
      <ToggleMarkItem markType={schema.marks["strong"]!} tooltip="Bold" shortcut="⌘B">
        <TextB size={18} weight="bold" />
      </ToggleMarkItem>
    );
  },
  meta: { label: "Bold", shortcut: "⌘B", group: "format", Icon: TextB },
});
```

### Node + node view + input rule (`Details`)

`src/editor/extensions/Details.tsx` is the reference for an interactive block node:

- Adds three nodes (`details`, `details_summary`, `details_content`).
- Registers an `inputRules` entry so typing `>>>␣` at the start of a paragraph turns it into a collapsible block.
- Installs a Plugin with a custom `NodeView` (`DetailsNodeView`) that wires the `<details>` toggle event back into a transaction that updates the `open` attribute.
- Exports a `commands` entry (`insert-details`) so the slash menu / keymap can trigger it.

For an image-style NodeView with mouse-driven resize + a bubble menu, see `src/editor/extensions/Image.tsx`. For an asynchronous placeholder driven by a consumer-supplied callback (insert → upload → replace), see `src/editor/extensions/ImageUpload.tsx`.

### Patching another extension's node (`TextAlign`)

Some extensions don't add new nodes — they augment ones already in the schema. `TextAlign` uses `patchNodes` to add an `align` attribute (and the matching `parseDOM` / `toDOM` hooks) to `paragraph` and `heading`:

```ts
patchNodes: {
  paragraph: withAlign,
  heading: withAlign,
},
```

`patchNodes` / `patchMarks` run after the contributing pass, so the target node must already exist in the schema (either from the base schema or an earlier extension). If it doesn't, schema construction throws `Extension "<name>" tried to patch node "<x>" but it does not exist`.

### Suggestion-driven popovers (`SlashMenu`, `Mention`, `Emoji`)

The `menu/Suggestion.tsx` module exposes two primitives:

- `createSuggestionPlugin({ char, allowSpaces?, startOfLine? })` — a ProseMirror plugin that tracks a trigger character and exposes `{ active, query, range }` via its plugin key.
- `<SuggestionPopover pluginKey={key} items={...} renderItem={...} onSelect={...} />` — a floating-ui popover that reads that plugin state, fetches items, handles keyboard navigation, and calls `onSelect` with the view, range, and chosen item.

To add a new triggered popover:

1. Create the plugin with a unique trigger char.
2. Register the plugin via `plugins: () => [plugin]` on your extension.
3. Render `<SuggestionPopover pluginKey={key} ... />` somewhere inside `<editor.Editor>` (alongside `<ProseMirrorDoc/>`).

`SlashMenu` is the most complete example — it builds an item list dynamically from `schema.nodes`, so it gracefully degrades when an extension isn't installed.

### Wiring an extension into the editor

`src/configuredEditor.ts` shows the canonical composition:

```tsx
const editor = createEditor([
  // History
  Undo, Redo, Separator,

  // Block style + font
  TextStyle, Separator, FontFamily, FontSize, Separator,

  // Inline marks
  Bold, Italic, Underline, Strike, Code, Kbd, Separator,

  // Color / Link / Align
  TextColor, Highlight, Separator, Link, Separator, TextAlign, Separator,

  // Lists
  Lists, BulletList, OrderedList, ListItem, TaskList, Separator,

  // Block-level structures
  Quote, PullQuote, CodeBlock, Callout, Details, DefinitionList, Separator,

  // Insert (media + content blocks)
  Image, DemoImageUpload, YouTube, Video, Audio,
  LinkCard, Math, Variables, DateExtension, Anchor, Table, Separator,
  Footnote, HorizontalRule, Separator,

  // Formatting tools + niche marks
  StripFormatting, InvisibleCharacters, LineHeight, Separator,
  Superscript, Subscript, Separator,
  Language, TextDirection, HardBreak,

  // System / no-toolbar
  Heading, Typography, Gapcursor, Dropcursor, Placeholder, TrailingNode,
  CharacterCount, Statistics, Focus, UniqueID, TableOfContents,
  MaintainSelection, ColorChip, SmartPaste, Linkify, HoverLink, FileHandler,
  SlashMenu, Mention, Emoji,
] as const);
```

The order matters in two places:

- **Toolbar render order** — `<Toolbar>` walks `editor.extensions` in order and renders each `ext.toolbar`. `Separator` is itself an extension whose only purpose is to render a `<ToolbarSeparator/>`.
- **Schema construction** — `patchNodes` / `patchMarks` need their target node to already be present, so the patching extension must come after the one contributing the node. (Within the same pass, contributing extensions are order-independent.)

Hooks for consumers are returned from `createEditor`:

```ts
editor.useRunCommand("bold")        // () => void
editor.useCanRunCommand("bold")     // boolean
editor.useIsActive("bold")          // boolean — keyed by extension name
editor.useEditor()                  // EditorHandle: { schema, commands, isActiveByExtension, extensions }
```

`useRunCommand` / `useCanRunCommand` are typed against the union of every command name across all extensions in the array — so `editor.useRunCommand("typo")` is a TypeScript error.

## Companion components

A handful of extensions install a ProseMirror plugin but expose their UI as a React component you render alongside `<ProseMirrorDoc/>`. Mount these inside `<editor.Editor>` so they can subscribe to editor state.

| Component | Pairs with | What it does |
|-----------|------------|--------------|
| `SlashMenuPopover` | `SlashMenu` | `/`-trigger floating menu of insertable blocks. |
| `MentionPopover` | `Mention` | `@`-trigger floating picker; pluggable item source. |
| `EmojiPopover` | `Emoji` | `:`-trigger emoji picker. |
| `MathInlinePopover` | `Math` | Edit-in-place popover for inline `inline_math` selections. |
| `VariableEditPopover` | `Variables` | Edit-in-place popover for selected variable chips. |
| `LinkHoverPopover` | `HoverLink` | Hover preview over any link with open / edit / remove buttons. |
| `TableOfContentsView` | `TableOfContents` | Standalone outline component reading the live TOC plugin state. |

Bubble-menu wrappers (`BubbleMenu`, `ImageBubbleMenu`, `TableBubbleMenu`) live in `src/` — render them inside `<editor.Editor>` to enable selection-anchored / image-anchored / table-anchored menus.

## Configurable extensions

Many extensions expose a `createXxx({...})` factory for options. Pattern:

```ts
import {
  createImageUpload,
  createMath,
  createMention,
  createTypography,
  Math,
} from "./editor/extensions";

createEditor([
  createTypography({ smartQuotes: false }),
  createMath({ katexOptions: { trust: true } }),
  createMention({ items: async (q) => fetchUsers(q) }),
  createImageUpload({ upload: async (file) => uploadToS3(file) }),
  // …
]);
```

The full options surface for every configurable extension is documented in [`docs/EXTENSIONS.md`](docs/EXTENSIONS.md).

## Menu primitives

Most extensions don't need to render raw buttons. The `menu/` folder has these building blocks:

| Primitive | Use it when… |
|-----------|--------------|
| `MenuItem` | You're rendering a custom button (e.g. opens a popover). |
| `CommandItem` | You have a ProseMirror `Command` and want it to disable when not runnable. |
| `ToggleMarkItem` | You're toggling a mark; sets `active` from `isMarkActive`. |
| `Dropdown` / `DropdownItem` | Radix dropdown menu with editor-aware `disabled` state. |
| `Tooltip` / `TooltipProvider` | Radix tooltip wrapper with shortcut display. |
| `FloatingMenu` | Anchors content to the current selection or a node — used by every bubble menu. |
| `Toolbar` / `ToolbarGroup` / `ToolbarSeparator` | Container with arrow-key roving focus and overflow-popover support. |
| `SuggestionPopover` + `createSuggestionPlugin` | Trigger-character popovers (`/`, `@`, `:`). |

These all use `useEditorState` / `useEditorEventCallback` from `@handlewithcare/react-prosemirror` — so call them from inside `<editor.Editor>`.

## Helpers (`src/editor/helpers.ts`)

Utilities you'll reach for when writing extensions:

- `isMarkActive(state, markType)` — selection-aware mark check.
- `isTextblockActive(state, nodeType, attrs?)` — current textblock matches type (and attrs).
- `isAncestorActive(state, nodeType)` — selection is anywhere inside a node of this type.
- `toggleWrap(nodeType)` — wraps in / lifts out of a block container (e.g. blockquote).
- `toggleList(listType, itemType)` — smart list toggle that converts between list types in place.
- `smartListInputRule(regex, listType, getAttrs?, joinPredicate?)` — input rule that respects existing lists and joins with neighbors.
- `smartSplitListItem(itemType)` — Enter behavior for list items: empty item lifts, otherwise splits.

## File layout

```
src/
  configuredEditor.ts       # composes the default editor + re-exports the demo doc
  Editor.stories.tsx        # the Fixed/Floating/DragDrop/Productivity/Stats/TOC stories
  styles.css                # all .pp-* styles for the editor and menus
  Toolbar.tsx               # walks editor.extensions and renders ext.toolbar in order
  BubbleMenu.tsx            # selection-anchored mark menu (Bold/Italic/.../Link)
  ImageBubbleMenu.tsx       # image controls — alt, align, width slider, delete
  TableBubbleMenu.tsx       # appears inside a table cell (row/col ops)
  StatsBar.tsx              # demo status bar wrapping useStatistics()
  DragDropEditor.tsx        # the @pitter-patter/shuffle drag-and-drop story

  demoDocs/
    helpers.ts              # makeDocHelpers(schema) — node/text/mark/para/h/li builders
    featureTour.ts          # the default "Fixed Toolbar" demo doc
    productivity.ts         # the template-style "Productivity" demo doc

  editor/
    Editor.tsx              # createEditor, schema/command/plugin assembly, EditorContext
    hooks.ts                # useIsActive, useCanRunCommand, useRunCommand
    helpers.ts              # isMarkActive, toggleList, smartListInputRule, …
    types.ts                # Extension contract + Extension.create()
    index.ts                # public surface (everything an extension or app needs)

    menu/                   # toolbar + popover primitives (see table above)
      Suggestion.tsx        # plugin + popover for trigger-char menus

    extensions/             # one file per extension, each export named — see
                            # docs/EXTENSIONS.md for the full per-extension reference
```

## Adding your own extension — checklist

1. Drop a new file in `src/editor/extensions/MyThing.tsx`.
2. Export `export const MyThing = Extension.create({ name: "my-thing", … })`.
3. Re-export from `src/editor/extensions/index.ts`.
4. Add to the `createEditor([...])` array in `src/configuredEditor.ts` (or wherever you compose the editor for your downstream app).
5. If it owns a popover, render it as a child of `<editor.Editor>` alongside `<ProseMirrorDoc/>`.
6. If it adds CSS, append to `src/styles.css` using the `pp-` prefix convention.
7. If it has options, expose a `createMyThing({...})` factory and document the options in `docs/EXTENSIONS.md`.

The schema, plugins, commands, and toolbar slot all wire up automatically.
