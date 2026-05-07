# Pitter Patter Extensions Cheatsheet

Every extension is opt-in — pass it to `createEditor([...])` to install it. Some expose a factory (`createXxx({...})`) for configuration; others are stateless and re-exported as a const. Components named `XxxPopover` or `XxxView` need to be rendered alongside `<editor.Editor>`.

## Inline marks

### Bold
Toggles the `strong` mark.
- Schema: adds mark `strong`
- Commands: `bold`
- Keymap: `Mod-b` → `bold`, `Mod-B` → `bold`
- Toolbar: yes

### Italic
Toggles the `em` mark.
- Schema: adds mark `em`
- Commands: `italic`
- Keymap: `Mod-i` → `italic`, `Mod-I` → `italic`
- Toolbar: yes

### Strike
Toggles a strikethrough mark.
- Schema: adds mark `strike`
- Commands: `strike`
- Keymap: `Mod-Shift-s` → `strike`, `Mod-Shift-S` → `strike`
- Toolbar: yes

### Code
Toggles inline `code` mark.
- Schema: adds mark `code`
- Commands: `code`
- Keymap: `Mod-e` → `code`, `Mod-E` → `code`
- Toolbar: yes

### Underline
Toggles an underline mark.
- Schema: adds mark `underline`
- Commands: `underline`
- Keymap: `Mod-u` → `underline`, `Mod-U` → `underline`
- Toolbar: yes

### Subscript
Toggles a `<sub>` mark; mutually excludes superscript.
- Schema: adds mark `subscript`
- Commands: `subscript`
- Keymap: `Mod-,` → `subscript`
- Toolbar: yes

### Superscript
Toggles a `<sup>` mark; mutually excludes subscript.
- Schema: adds mark `superscript`
- Commands: `superscript`
- Keymap: `Mod-.` → `superscript`
- Toolbar: yes

### Highlight
Wraps the selection in a colored `<mark>` with a swatch dropdown.
- Schema: adds mark `highlight` (attr: `color`)
- Commands: `highlight`
- Keymap: `Mod-Shift-h` → `highlight`, `Mod-Shift-H` → `highlight`
- Toolbar: yes (swatch dropdown with 8 preset colors plus "Remove highlight")

### Link
Toggles a `link` mark; click the toolbar item for a URL popover.
- Schema: adds mark `link`
- Commands: `link`
- Keymap: `Mod-k` → `link`, `Mod-K` → `link`
- Toolbar: yes (Radix popover for URL entry)
- Options (`createLink`):
  - `linkOnPaste?: boolean` (default `true`) — wrap the current selection with a link when a URL is pasted on top of it.
- Companion exports: `Link.configure(options)`, helpers `getActiveHref`, `applyLink`, `removeLink`.

### Kbd
Wraps text in `<kbd>` for keyboard-shortcut formatting.
- Schema: adds mark `kbd`
- Commands: `kbd`
- Keymap: `Mod-Alt-k` → `kbd`
- Toolbar: yes

### Language
Tags inline phrases with a BCP-47 `lang` attribute via `<span lang>`.
- Schema: adds mark `language` (attr: `lang`)
- Toolbar: yes (dropdown of preset languages)
- Options (`createLanguage`):
  - `languages?: LanguageChoice[]` (default `DEFAULT_LANGUAGES`) — list of `{ code, label }` entries shown in the dropdown.
- Companion exports: `DEFAULT_LANGUAGES` constant, `LanguageChoice` type.

## Block nodes

### Heading
Toggles paragraph ↔ heading levels 1–4.
- Commands: `heading-1`, `heading-2`, `heading-3`, `heading-4`
- Keymap: `Mod-Alt-1` → `heading-1`, `Mod-Alt-2` → `heading-2`, `Mod-Alt-3` → `heading-3`, `Mod-Alt-4` → `heading-4`
- Input rules: `# `, `## `, `### `, …, `###### ` → heading of matching level (relies on the `heading` node defined upstream of this extension)

### Quote
Wraps the active block in `<blockquote>`.
- Commands: `quote`
- Keymap: `Mod-Shift-.` → `quote`
- Toolbar: yes

### PullQuote
Toggles an `<aside class="pp-pullquote">` block.
- Schema: adds node `pull_quote`
- Commands: `pull-quote`
- Toolbar: yes

### CodeBlock
Toggles a `code_block`.
- Commands: `code-block`
- Keymap: `Mod-Alt-c` → `code-block`, `Mod-Alt-C` → `code-block`
- Input rules: ` ``` ` → code block
- Toolbar: yes

### BulletList
Toggle/build a `<ul>` of list items.
- Schema: adds node `bullet_list`
- Commands: `bullet-list`
- Keymap: `Mod-Shift-8` → `bullet-list`
- Input rules: `- `, `+ `, `* ` → bullet list

### OrderedList
Toggle/build an `<ol>` of list items.
- Schema: adds node `ordered_list` (attr: `order`)
- Commands: `ordered-list`
- Keymap: `Mod-Shift-7` → `ordered-list`
- Input rules: `1. ` (any number) → ordered list starting at that number

### ListItem
Generic `<li>` — required by `BulletList` and `OrderedList`.
- Schema: adds node `list_item`
- Commands: `list-item-split`, `list-item-sink`, `list-item-lift`
- Keymap: `Enter` → `list-item-split`, `Tab` → `list-item-sink`, `Shift-Tab` → `list-item-lift`

### Lists
Single dropdown trigger that switches between bullet/ordered/task lists. Pure UI; install alongside the underlying list extensions.
- Toolbar: yes (combined dropdown with shortcut hints `⌘⇧8`/`⌘⇧7`/`⌘⇧9`)

### TaskList
Checkbox list with persistent `checked` state.
- Schema: adds nodes `task_list`, `task_item` (attr: `checked`)
- Commands: `task-list-toggle`, `task-item-split`, `task-item-sink`, `task-item-lift`
- Keymap: `Mod-Shift-9` → `task-list-toggle`, `Enter` → `task-item-split`, `Tab` → `task-item-sink`, `Shift-Tab` → `task-item-lift`
- Input rules: `[ ] ` / `[x] ` (start of line) → task list with that checked state

### Callout
Tinted callout block with five variants.
- Schema: adds node `callout` (attr: `variant` — one of `note`, `info`, `tip`, `warning`, `danger`)
- Toolbar: yes (dropdown swatch picker per variant + remove)
- Companion exports: `CALLOUT_VARIANTS`, `CalloutVariant` type, `setCallout(type, variant)`, `unsetCallout(type)` command builders.

### Details
Native `<details>`/`<summary>` collapsible block; clicking the disclosure caret persists the `open` attr through a NodeView.
- Schema: adds nodes `details` (attr: `open`), `details_summary`, `details_content`
- Commands: `insert-details`
- Input rules: `>>> ` → empty details block
- Toolbar: yes

### DefinitionList
Inserts a `<dl>` containing one `<dt>`/`<dd>` pair.
- Schema: adds nodes `definition_list`, `definition_term`, `definition_description`
- Commands: `definition-list`
- Toolbar: yes

### HorizontalRule
Inserts an `<hr>`.
- Commands: `horizontal-rule`
- Input rules: `---`, `***`, `___` (each followed by space) → horizontal rule

### Footnote
Numbered footnote system with auto-renumbering and a synced footnotes list at the bottom of the doc.
- Schema: adds nodes `footnote_reference`, `footnote`, `footnotes`
- Commands: `addFootnote`, `nextFootnote`, `prevFootnote`
- Keymap: `Tab` → `nextFootnote`, `Shift-Tab` → `prevFootnote` (only inside a footnote)
- Input rules: `[^anything]` → inserts a footnote reference (bracketed text discarded)
- Toolbar: yes
- Notes: a plugin filters edits that span body+footnotes and auto-rebuilds/renumbers the footnotes list whenever references change.

### HardBreak
Inserts a `<br>`.
- Commands: `hard-break`
- Keymap: `Shift-Enter` → `hard-break`, `Mod-Enter` → `hard-break`

## Inline atoms

### Image
Block-level image node with width, alignment, and an in-editor resize NodeView.
- Schema: adds node `image` (block, atom, draggable; attrs `src`, `alt`, `title`, `width`, `align`)
- Commands: `setImageAlign(align)`, `setImageWidth(percent)` — exported as named functions, not via the `commands` map
- Input rules: `![alt](src "title")` at line start
- Toolbar: yes (popover with URL + alt + file upload — the Add button)
- Companion: pair with `ImageBubbleMenu` (in `src/`) for align toggles + width slider on selection
- Resize: side handles appear when an image is selected; drag to resize between 15–100%

### ImageUpload
Drop-zone placeholder block driven by a consumer-supplied upload callback.
- Schema: adds node `image_upload` (block, atom; attrs `id`, `label`, `state`)
- Plugin handlers: `handlePaste` / `handleDrop` route raw image files anywhere in the doc through the same uploader
- Toolbar: yes (Upload image button)
- Options (`createImageUpload({...})`):
  - `upload(file: File): Promise<string>` — required; resolve to the URL the placeholder will be replaced with
  - `accept?: string` — file picker MIME filter, default `image/*`
- Companion exports: `simulateUpload(delayMs)` — dev helper that data-URLs the file after a delay; `insertImageUploadCommand(uploadType)` for slash-menu integration

### YouTube
Embeds a YouTube video (iframe) inserted via toolbar popover or auto-embed on paste of a bare URL.
- Schema: adds node `youtube` (attrs: `src`, `width`, `height`)
- Toolbar: yes (URL popover with validation)
- Options (`createYouTube`):
  - `privacyMode?: boolean` (default `true`) — use `youtube-nocookie.com` instead of `youtube.com`.

### Audio
`<audio controls>` block; auto-embeds bare audio URLs pasted into an empty paragraph.
- Schema: adds node `audio` (attrs: `src`, `title`)
- Toolbar: yes (URL/title popover)

### Video
`<video controls>` block with optional poster; auto-embeds bare video URLs pasted into an empty paragraph.
- Schema: adds node `video` (attrs: `src`, `poster`, `title`, `width`, `height`)
- Toolbar: yes (URL/poster popover)

### Math
Inline and block LaTeX rendered via KaTeX. Inline math edits via a floating popover; block math swaps to a textarea+preview when selected.
- Schema: adds nodes `inline_math`, `block_math` (attr: `latex`)
- Input rules: `$...$` → inline math, `$$...$$` (own line) → block math
- Toolbar: yes (insert popover with inline/block toggle and live preview)
- Companion components: `MathInlinePopover` — render alongside `<editor.Editor>` to enable inline math editing.
- Options (`createMath`):
  - `katexOptions?: KatexOptions` — passed through to `katex.render`. See https://katex.org/docs/options.html.
- Companion exports: `migrateMathStrings(view, type, pattern?)` and `migrateMathStringsTransaction(state, type, pattern?)` — convert `$...$` text strings in an existing doc to `inline_math` nodes.

### Variables
`{{name}}` template variables with a known-list dropdown and freeform entry; selected variable shows an edit popover.
- Schema: adds node `variable` (attrs: `name`, `defaultValue`)
- Toolbar: yes (Radix dropdown listing known variables + optional add form)
- Companion components: `VariableEditPopover` — render alongside `<editor.Editor>` to enable in-place edits of selected variables.
- Options (`createVariables`):
  - `variables?: VariableDefinition[]` (default `[]`) — known variables surfaced in the dropdown.
  - `allowFreeform?: boolean` (default `true`) — allow inserting variables not in the list.
- Companion exports: `VariableDefinition` type.

### Date
Calendar-date inline atom rendered as `<time datetime>`.
- Schema: adds node `date` (attr: `value`, ISO `YYYY-MM-DD`)
- Toolbar: yes (date picker popover with "Today" shortcut)
- Notes: exported as `Date` (the implementation file declares `DateExtension` and re-aliases it to `Date`).

### Anchor
Empty named anchor (`<a id="...">`) for in-page jumps.
- Schema: adds node `anchor` (attr: `id`)
- Toolbar: yes (ID input popover)

### Mention
`@user` suggestion atom.
- Schema: adds node `mention` (attrs: `id`, `label`)
- Toolbar: no
- Companion components: `MentionPopover` — must be rendered alongside `<editor.Editor>`. Accepts `items?: (query) => MentionItem[] | Promise<MentionItem[]>` to drive the suggestion list (defaults to a built-in demo set).
- Options (`createMention`):
  - `items?: (query: string) => MentionItem[] | Promise<MentionItem[]>` — accepted on the type but currently unused by the extension itself; configure the popover instead.
- Companion exports: `Mention.configure(options)`, `MentionItem` type.

### Emoji
`:name:` suggestion atom that inserts a literal emoji character.
- Toolbar: no
- Companion components: `EmojiPopover` — must be rendered alongside `<editor.Editor>`.

## Tables

### Table
Full prosemirror-tables integration with an insert/manipulate dropdown.
- Schema: adds nodes `table`, `table_row`, `table_cell`, `table_header`
- Commands: `addColumnAfter`, `addColumnBefore`, `addRowAfter`, `addRowBefore`, `deleteRow`, `deleteColumn`, `deleteTable`, `mergeCells`, `splitCell`, `toggleHeaderRow`, `toggleHeaderColumn`, `table-next-cell`, `table-prev-cell`
- Keymap: `Tab` → `table-next-cell`, `Shift-Tab` → `table-prev-cell`
- Toolbar: yes (insert 3×3 plus row/column/header operations)
- Companion exports: `insertTable(rows, cols, withHeader)` command builder.

## Text styling (schema patches)

### TextStyle
Block-style picker (Paragraph, Heading 1–4) shown as a labeled dropdown.
- Commands: `paragraph`
- Keymap: `Mod-Alt-0` → `paragraph`
- Toolbar: yes (preview-rendered dropdown)

### TextAlign
Adds an `align` attr to paragraph/heading and toolbar buttons for left/center/right/justify.
- Schema: patches `paragraph` and `heading` with an `align` attribute (values: `left`, `center`, `right`, `justify`)
- Toolbar: yes (four alignment buttons)

### TextColor
Inline text color via swatch dropdown.
- Schema: adds mark `text_color` (attr: `color`)
- Toolbar: yes (8 preset swatches plus "Default color")

### TextDirection
LTR/RTL dropdown affecting paragraph/heading via a `dir` attr.
- Schema: patches `paragraph` and `heading` with a `dir` attribute (values: `ltr`, `rtl`)
- Toolbar: yes (LTR/RTL pair)

### FontFamily
Font picker mark with optional Google Fonts preload.
- Schema: adds mark `font_family` (attr: `fontFamily`)
- Toolbar: yes (dropdown with recent + alphabetized list, previews each option in its own face)
- Options (`createFontFamily`):
  - `options?: FontFamilyOption[]` (default `DEFAULT_FONT_FAMILIES`) — choices in the dropdown.
  - `defaultLabel?: string | "auto"` (default `"Font"`) — label for the no-font-set option. `"auto"` resolves it from `getComputedStyle` of the active block.
- Companion exports: `DEFAULT_FONT_FAMILIES` constant, `FontFamilyOption` type.

### FontSize
Font size picker mark.
- Schema: adds mark `font_size` (attr: `fontSize`)
- Toolbar: yes (dropdown of preset sizes plus a clear option)
- Options (`createFontSize`):
  - `sizes?: string[]` (default `DEFAULT_FONT_SIZES` — 14 entries from `10px` to `72px`).
  - `defaultLabel?: string` (default `"Size"`).
- Companion exports: `DEFAULT_FONT_SIZES` constant.

### LineHeight
Line-height picker for paragraph/heading.
- Schema: patches `paragraph` and `heading` with a `lineHeight` attribute
- Toolbar: yes (dropdown of presets plus a clear option)
- Options (`createLineHeight`):
  - `values?: string[]` (default `DEFAULT_LINE_HEIGHTS` — `["1", "1.15", "1.5", "2", "2.5", "3"]`).
  - `defaultLabel?: string` (default `"Line"`).
- Companion exports: `DEFAULT_LINE_HEIGHTS` constant.

### UniqueID
Auto-assigns stable IDs to selected node types; de-dupes after paste; doesn't pollute the undo stack.
- Schema: patches each configured node type with an ID attribute
- Options (`createUniqueID`):
  - `nodes?: string[]` (default `["heading", "paragraph"]`) — node type names that receive IDs.
  - `attrName?: string` (default `"id"`) — attribute key for the assigned ID.
  - `generateID?: () => string` (default `crypto.randomUUID()` falling back to short base36) — ID generator.

## Productivity & polish (system plugins)

### Ai
Streaming AI assistant. The editor sends the current selection to a backend that proxies an LLM (Anthropic via Vercel AI SDK in the bundled `dev:server`) and inserts streamed chunks into the doc with a preview decoration. Accept replaces the original; Reject deletes the streamed range.
- Schema: none — state lives in a plugin
- Plugin: `aiPluginKey` carries `{ status, originalRange, streamRange, generatedWith, error }`. State maps forward across edits so the preview decoration tracks the streamed range correctly.
- Decorations: paints the streamed range with `pp-ai-preview-streaming` / `-done` / `-error` class while the flow is active
- Toolbar: yes (Sparkle icon → popover with prompt input + 8 preset modes)
- Companion: pair with `AiPreviewActions` (rendered alongside `<editor.Editor>`) for the floating Accept / Regenerate / Reject controls
- Companion exports: `useAi(options)` hook returning `{ status, prompt, transform, accept, reject, regenerate, cancel }`; `runAiRequest(view, options)` for direct integration; `aiAccept()` / `aiReject()` Commands for keymap binding
- Options (`createAi({...})`):
  - `baseUrl?: string` — backend URL, defaults to `http://localhost:3001/api/ai` (the bundled dev server)
- Preset modes: `rephrase`, `shorten`, `extend`, `fix-grammar`, `summarize`, `tldr`, `tone-formal`, `tone-casual`, `translate`. Each maps to a system prompt server-side.
- Backend: see `scripts/dev-server.ts` and `scripts/server/ai.ts`. Run `yarn dev:server` and set `ANTHROPIC_API_KEY` in `.env`.

### Typography
As-you-type symbol substitutions.
- Input rules: `--` → en dash, `---` → em dash, `->`/`<-`/`<->`/`=>`/`<<`/`>>` → arrows, `...` → ellipsis, `(c)`/`(r)`/`(tm)`/`+-` → `©`/`®`/`™`/`±`, straight quotes → curly quotes (context-aware)
- Options (`createTypography`):
  - `dashes?: boolean` (default `true`)
  - `arrows?: boolean` (default `true`)
  - `ellipsis?: boolean` (default `true`)
  - `symbols?: boolean` (default `true`)
  - `smartQuotes?: boolean` (default `true`)
- Companion exports: `Typography.configure(options)`.

### Placeholder
Renders a placeholder string in empty textblocks via decorations.
- Options (`createPlaceholder`):
  - `placeholder?: string | ((node) => string)` (default `"Type / for commands"`).
  - `showOnlyCurrent?: boolean` (default `true`) — render only in the empty block under the cursor.
  - `className?: string` (default `"pp-empty-block"`).

### TrailingNode
Appends a trailing paragraph so the user can always click below the last block to type.
- Options (`createTrailingNode`):
  - `nodeName?: string` (default `"paragraph"`).
  - `notAfter?: string[]` (default `["paragraph"]`) — types that don't trigger the append.

### Gapcursor
Re-export of `prosemirror-gapcursor` so the cursor can sit between block-only nodes (after a table, between two stacked images, etc.). No options.

### Dropcursor
Re-export of `prosemirror-dropcursor` for the drag-drop indicator line.
- Options (`createDropcursor`):
  - `color?: string` (default `"#3b82f6"`).
  - `width?: number` (default `2`).
  - `class?: string` — CSS class on the cursor element.

### CharacterCount
Plugin that caches `{ characters, words }` per doc change.
- Companion exports: `useCharacterCount()` hook returning `{ characters, words }`, `characterCountKey` PluginKey, `CharacterCountState` type.

### Statistics
Plugin that caches characters/words/paragraphs/headings; reading time computed in the hook.
- Options (`createStatistics`):
  - `wordsPerMinute?: number` (default `250`).
- Companion exports: `useStatistics({ wordsPerMinute? })` hook returning `DocumentStatistics`, `statisticsKey` PluginKey, `DocumentStatistics`/`StatisticsOptions` types.

### Focus
Adds a class to the block containing the selection (host wires up CSS).
- Options (`createFocus`):
  - `className?: string` (default `"is-focused"`).
  - `mode?: "deepest" | "shallowest"` (default `"deepest"`) — which ancestor block carries the class.

### MaintainSelection
Paints a decoration over the last selection when the editor blurs (so popover/toolbar interactions don't visually drop the user's selection).
- Options (`createMaintainSelection`):
  - `className?: string` (default `"pp-blur-selection"`).

### ColorChip
Inline decoration that paints a swatch next to any hex color (`#fff`, `#aabbcc`) appearing in text.
- Options (`createColorChip`):
  - `className?: string` (default `"pp-color-chip"`).

### SmartPaste
Cleans pasted HTML — strips MS Office cruft, Google Docs wrappers, Notion artifacts, classes, most inline styles, and empty paragraphs.
- Options (`createSmartPaste`):
  - `cleanWord?: boolean` (default `true`).
  - `cleanGoogleDocs?: boolean` (default `true`).
  - `cleanNotion?: boolean` (default `true`).
  - `stripEmptyParagraphs?: boolean` (default `true`).
  - `allowedInlineStyles?: string[]` (default `["text-align", "color", "background-color"]`) — inline style props preserved.
  - `preserveClasses?: RegExp | null` (default `null`) — when null, all class attrs are stripped; pass a regex to keep matches.
  - `transformHTML?: (html: string) => string` — custom transformer applied last.

### Linkify
As-you-type URL → `link` mark. Matches `http(s)://…` or `www.…` followed by a space and applies the link mark to the URL run. Pasted URLs are not touched (let the host's paste pipeline decide).

### HoverLink
Floating popover anchored to a hovered link with open/edit/remove affordances. Skips link-card and footnote-reference anchors.
- Companion components: `LinkHoverPopover` — render alongside `<editor.Editor>`. The `HoverLink` extension itself is a no-op marker.

### FileHandler
Generic paste/drop file handler.
- Options (`createFileHandler`):
  - `allowedMimeTypes?: readonly string[]` — exact MIME match or wildcards (`image/*`, `*`); when omitted, every File is forwarded.
  - `onPaste?: (files, view, event) => boolean | void` — return `true` to mark handled.
  - `onDrop?: (files, view, event, pos) => boolean | void` — receives the resolved doc position under the drop coordinates (or `null`).

### InvisibleCharacters
Toggles inline decorations for spaces/tabs, pilcrow at end of each non-empty textblock, and `↵` for hard breaks.
- Toolbar: yes (eye toggle)
- Options (`createInvisibleCharacters`):
  - `defaultVisible?: boolean` (default `false`) — initial visibility on mount.
- Companion exports: `invisibleCharsKey` PluginKey (set boolean meta on it to control visibility programmatically).

### StripFormatting
Clear-formatting command that drops marks; optionally also resets non-paragraph textblocks back to paragraphs.
- Commands: `clearFormatting`
- Keymap: `Mod-\` → `clearFormatting`
- Toolbar: yes
- Options (`createStripFormatting`):
  - `clearBlocks?: boolean` (default `false`) — also reset block-level formatting.
- Companion exports: `clearFormattingCommand(schema, options)` builder.

## Suggestion/menu surfaces

### SlashMenu
Type `/` to open a block-insert command palette (paragraph, headings, lists, callouts, code, quote, divider, details, table, footnote, etc.).
- Toolbar: no
- Companion components: `SlashMenuPopover` — render alongside `<editor.Editor>`.

### TableOfContents
Plugin that maintains an outline of headings (positions, slugs, hierarchical numbering, active flag) and decorates each heading with `data-toc-id`/`id`.
- Toolbar: no
- Companion components: `TableOfContentsView` — drop-in sidebar; click an item to scroll the heading into view, set the cursor in it, and update the URL hash. Props: `scrollContainer?: Element | Window | null`, `emptyState?: ReactNode`, `hideNumbers?: boolean`, `className?: string`.
- Options (`createTableOfContents`):
  - `getId?: (text, node) => string` (default: slugify) — id generator.
  - `getIndex?: TocIndexer` (default: `hierarchicalIndexer`) — produces the per-item index string.
  - `onUpdate?: (items: TocItem[]) => void` — non-React callback for items changes.
- Companion exports: `useTableOfContents()` hook, `useScrolledOverItems(items, container?)` hook, `hierarchicalIndexer`/`linearIndexer` indexers, `tocKey` PluginKey, `TocItem`/`TableOfContentsState`/`TableOfContentsOptions`/`TocIndexer` types.

### LinkCard
Open Graph–style card block. Pasting a bare URL into an empty paragraph creates an unloaded card; click selects, double-click opens, cmd/ctrl-click follows the link natively.
- Schema: adds node `link_card` (attrs: `url`, `title`, `description`, `image`, `siteName`, `loaded`)
- Toolbar: yes (URL/title popover)
- Options (`createLinkCard`):
  - `fetchMetadata?: (url) => Promise<LinkCardMetadata>` — async metadata fetcher; without one, cards render as bare-URL cards permanently.
- Companion exports: `LinkCardMetadata` type.

## Toolbar utilities

### Undo
Toolbar button bound to `prosemirror-history`'s `undo`. The keymap is registered by `prosemirror-history` (typically wired up in `createEditor`), not by this extension.
- Toolbar: yes

### Redo
Toolbar button bound to `prosemirror-history`'s `redo`.
- Toolbar: yes

### Separator
Visual separator inside the toolbar.
- Toolbar: yes (just renders a divider)
