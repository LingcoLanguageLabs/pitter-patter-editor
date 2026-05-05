# Pitter Patter Editor

A small, opinionated rich-text editor built on [ProseMirror](https://prosemirror.dev/) and React 19, using [`@handlewithcare/react-prosemirror`](https://github.com/handlewithcare/react-prosemirror) for the React bindings. Everything visible in the editor — marks, nodes, keymaps, toolbar buttons, slash menu, suggestions, input rules — is contributed by an **extension**. There is no monolithic config; you compose an editor by passing a list of extensions to `createEditor`.

The architecture is intentionally close to ProseMirror primitives. There is no "framework layer" hiding the schema or plugin system — extensions return raw `NodeSpec` / `MarkSpec` / `Plugin` / `Command` values, and the editor wires them together.

<img width="1090" height="632" alt="image" src="https://github.com/user-attachments/assets/d530db90-b129-4f42-b7c8-636533633a8f" />

## Quick start

```bash
yarn install
yarn dev        # vite dev server
yarn build      # tsc -b && vite build
yarn preview
```

The dev entry point is `src/main.tsx`, which mounts the demo app from `index.html`.

> Yarn PnP: this repo uses Yarn Plug'n'Play (`.pnp.cjs`, `.pnp.loader.mjs`). Use `yarn` rather than `npm`.

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

This is the pattern to copy when your extension owns DOM that the user can interact with directly.

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

`src/main.tsx`:

```tsx
const editor = createEditor([
  Undo, Redo, Separator,
  TextStyle, Heading, Lists, BulletList, OrderedList, ListItem, TaskList,
  Quote, CodeBlock, Details, Separator,
  Bold, Italic, Strike, Code, Underline,
  TextColor, Highlight, Link, Separator,
  Superscript, Subscript, Separator,
  TextAlign, Separator,
  HorizontalRule, HardBreak,
  Table, Image, Typography, SlashMenu, Mention, Emoji,
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

## What the menu primitives give you

Most extensions don't need to render raw buttons. The `menu/` folder has these building blocks:

| Primitive | Use it when… |
|-----------|--------------|
| `MenuItem` | You're rendering a custom button (e.g. opens a popover). |
| `CommandItem` | You have a ProseMirror `Command` and want it to disable when not runnable. |
| `ToggleMarkItem` | You're toggling a mark; sets `active` from `isMarkActive`. |
| `Dropdown` / `DropdownItem` | Radix dropdown menu with editor-aware `disabled` state. |
| `Tooltip` / `TooltipProvider` | Radix tooltip wrapper with shortcut display. |
| `FloatingMenu` | Anchors content to the current selection or a node — used by every bubble menu. |
| `Toolbar` / `ToolbarGroup` / `ToolbarSeparator` | Container with arrow-key roving focus. |
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
  main.tsx                  # demo app: composes the editor, renders toolbar + menus
  styles.css                # all .pp-* styles for the editor and menus
  Toolbar.tsx               # walks editor.extensions and renders ext.toolbar in order
  BubbleMenu.tsx            # selection-anchored mark menu (Bold/Italic/.../Link)
  ImageBubbleMenu.tsx       # appears when an image is selected (alt text + delete)
  TableBubbleMenu.tsx       # appears inside a table cell (row/col ops)

  editor/
    Editor.tsx              # createEditor, schema/command/plugin assembly, EditorContext
    hooks.ts                # useIsActive, useCanRunCommand, useRunCommand
    helpers.ts              # isMarkActive, toggleList, smartListInputRule, …
    types.ts                # Extension contract + Extension.create()
    index.ts                # public surface (everything an extension or app needs)

    menu/                   # toolbar + popover primitives (see table above)
      Suggestion.tsx        # plugin + popover for trigger-char menus

    extensions/             # one file per extension, each export named
      Bold/Italic/Underline/Strike/Code        # marks (toggleMark)
      Subscript/Superscript                    # marks
      Heading/Quote/CodeBlock/HorizontalRule   # blocks
      BulletList/OrderedList/ListItem/Lists    # lists; Lists is the toolbar dropdown
      TaskList                                 # custom list with a checkbox node view
      TextStyle                                # block-style picker (Paragraph / H1–H4)
      TextAlign                                # patches paragraph + heading with align attr
      TextColor / Highlight                    # colored marks with swatch dropdowns
      Link                                     # mark + popover + paste-to-link plugin
      Image                                    # node + popover (URL or file upload)
      Table                                    # prosemirror-tables nodes + plugin + dropdown
      Details                                  # collapsible node + node view + input rule
      Typography                               # input rules: dashes, arrows, smart quotes, …
      SlashMenu                                # `/`-trigger popover; commands derived from schema
      Mention                                  # `@`-trigger; node + popover (configurable items)
      Emoji                                    # `:`-trigger; inserts unicode characters
      Undo / Redo / Separator / HardBreak      # toolbar-only or behavior-only
```

## Built-in extensions reference

| Name | Adds | Commands | Notes |
|------|------|----------|-------|
| `Bold`, `Italic`, `Strike`, `Code`, `Underline` | `strong`, `em`, `s`, `code`, `underline` marks | `bold`, `italic`, `strike`, `code`, `underline` | `Mod-b/i/etc.` |
| `Superscript`, `Subscript` | marks | `superscript`, `subscript` | mutually exclusive when toggled |
| `Heading` | uses `heading` from base schema | `heading-1`…`heading-4` | `# `…`#### ` input rule, `Mod-Alt-1`…`4` |
| `Quote` | uses `blockquote` | `quote` | `> ` input rule |
| `CodeBlock` | uses `code_block` | `code-block` | ```` ``` ```` input rule, `Mod-Alt-c` |
| `BulletList`, `OrderedList`, `ListItem` | `bullet_list`, `ordered_list`, `list_item` | various toggle/sink/lift | Smart input rules; ordered list reads `1. `, etc. |
| `Lists` | toolbar only | — | Dropdown that picks among installed list types |
| `TaskList` | `task_list`, `task_item` w/ checkbox node view | `task-list-toggle`, sink/lift/split | `[ ] ` / `[x] ` input rule |
| `TextStyle` | toolbar only | `paragraph` | Block-style dropdown |
| `TextAlign` | patches `paragraph` + `heading` with `align` attr | — | Four toolbar buttons |
| `TextColor`, `Highlight` | `text_color`, `highlight` marks | `highlight` | Swatch dropdowns + remove button |
| `Link` | `link` mark | `link` | Popover, `Mod-K`, paste-URL-onto-selection plugin |
| `Image` | uses `image` from base schema | — | URL or file upload via popover; data-URL for files |
| `Table` | `prosemirror-tables` nodes + `tableEditing()` | row/col/cell ops | `Tab`/`Shift-Tab` to navigate cells |
| `Details` | `details`, `details_summary`, `details_content` + node view | `insert-details` | `>>>␣` input rule |
| `Typography` | input rules only | — | Configurable: `dashes`, `arrows`, `ellipsis`, `symbols`, `smartQuotes` |
| `HorizontalRule` | uses `horizontal_rule` | (toolbar action) | `---` input rule |
| `HardBreak` | uses `hard_break` | `hard-break` | `Shift-Enter` / `Mod-Enter` |
| `SlashMenu` | suggestion plugin | — | Items built from `schema.nodes` at render time |
| `Mention` | `mention` atom node + suggestion plugin | — | `Mention.configure({ items })` for custom item source |
| `Emoji` | suggestion plugin only | — | Inserts plain unicode |
| `Undo`, `Redo` | toolbar buttons | — | History plugin is added by `Editor.tsx` unconditionally |
| `Separator` | toolbar separator | — | Use multiple times to group toolbar buttons |

### Configurable extensions

A few extensions expose a `configure()` factory that returns a fresh extension with custom options. Pattern:

```ts
import { Mention, Typography, Link } from "./editor/extensions";

createEditor([
  Link.configure({ linkOnPaste: false }),
  Typography.configure({ smartQuotes: false }),
  Mention.configure({ items: async (q) => fetchUsers(q) }),
] as const);
```

Today the configurable extensions are `Link`, `Typography`, and `Mention`. Adopt the same `Object.assign(createXxx(), { configure: (opts) => createXxx(opts) })` shape for new extensions that need options.

## Adding your own extension — checklist

1. Drop a new file in `src/editor/extensions/MyThing.tsx`.
2. Export `export const MyThing = Extension.create({ name: "my-thing", … })`.
3. Re-export from `src/editor/extensions/index.ts`.
4. Add to the `createEditor([...])` array in `src/main.tsx` (or wherever you compose the editor for your downstream app).
5. If it owns a popover, render it as a child of `<editor.Editor>` alongside `<ProseMirrorDoc/>`.
6. If it adds CSS, append to `src/styles.css` using the `pp-` prefix convention.

The schema, plugins, commands, and toolbar slot all wire up automatically.
