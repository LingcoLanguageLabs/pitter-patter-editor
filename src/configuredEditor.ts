import type { Schema } from "prosemirror-model";

import { createEditor } from "./editor";
import { createPages } from "./editor/extensions/Pages";
import {
  Ai,
  AiCaret,
  Anchor,
  Audio,
  Bold,
  BulletList,
  Callout,
  CharacterCount,
  Code,
  CodeBlock,
  ColorChip,
  createImageUpload,
  Date as DateExtension,
  DefinitionList,
  Details,
  Dropcursor,
  Emoji,
  FileHandler,
  Focus,
  FontFamily,
  FontSize,
  Footnote,
  Gapcursor,
  HardBreak,
  Heading,
  Highlight,
  HorizontalRule,
  HoverLink,
  Image,
  InvisibleCharacters,
  Italic,
  Kbd,
  Language,
  LineHeight,
  Link,
  LinkCard,
  Linkify,
  ListItem,
  Lists,
  MaintainSelection,
  Math,
  Mention,
  OrderedList,
  PageBreak,
  History,
  Placeholder,
  PullQuote,
  Quote,
  Separator,
  simulateUpload,
  SlashMenu,
  SmartPaste,
  Statistics,
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
  UniqueID,
  Unsplash,
  Variables,
  Video,
  YouTube,
} from "./editor/extensions";

// Default ImageUpload uses simulateUpload — consumers should pass their
// own upload callback (e.g. an S3 signed URL flow) when composing their
// own editor. The simulator just FileReader's the file into a data URL
// after a delay, which is fine for demos but not production.
const DemoImageUpload = createImageUpload({ upload: simulateUpload(1200) });

// Toolbar order is Google Docs-flavored: history → style → font → inline marks
// → color → link → align → lists → block formatters → insert blocks →
// formatting tools → niche/sub-sup/language. Earlier-in-array means
// higher-priority and stays visible longer; later items are first to land in
// the overflow popover when the toolbar is narrow.
export const editor = createEditor([
  // History
  History,
  Separator,

  // AI assistant
  Ai,
  AiCaret,
  Separator,

  // Block style + font (Docs has these adjacent: "Normal text" then font/size)
  TextStyle,
  Separator,
  FontFamily,
  FontSize,
  Separator,

  // Inline marks
  Bold,
  Italic,
  Underline,
  Strike,
  Code,
  Kbd,
  Separator,

  // Color
  TextColor,
  Highlight,
  Separator,

  // Link
  Link,
  Separator,

  // Block alignment + lists
  TextAlign,
  Separator,
  Lists,
  BulletList,
  OrderedList,
  ListItem,
  TaskList,
  Separator,

  // Block-level structures
  Quote,
  PullQuote,
  CodeBlock,
  Callout,
  Details,
  DefinitionList,
  Separator,

  // Insert (media + content blocks)
  Image,
  DemoImageUpload,
  Unsplash,
  YouTube,
  Video,
  Audio,
  LinkCard,
  Math,
  Variables,
  DateExtension,
  Anchor,
  Table,
  Separator,
  Footnote,
  HorizontalRule,
  PageBreak,
  Separator,

  // Formatting tools
  StripFormatting,
  InvisibleCharacters,
  LineHeight,
  Separator,

  // Less-common inline marks (overflow first)
  Superscript,
  Subscript,
  Separator,

  // Niche
  Language,
  TextDirection,
  HardBreak,

  // Schema-only / system extensions (no toolbar items)
  Heading,
  Typography,
  Gapcursor,
  Dropcursor,
  Placeholder,
  TrailingNode,
  CharacterCount,
  Statistics,
  Focus,
  UniqueID,
  TableOfContents,
  MaintainSelection,
  ColorChip,
  SmartPaste,
  Linkify,
  HoverLink,
  FileHandler,
  SlashMenu,
  Mention,
  Emoji,
] as const);

export type EditorCommand = Parameters<typeof editor.useRunCommand>[0];

/**
 * A second editor instance configured for pagination mode. Pages is
 * surface-changing (it sizes the editor to one page width and inserts
 * page-break stripes), so we keep it as an opt-in companion to the
 * default `editor` rather than enabling it everywhere.
 */
export const pagesEditor = createEditor([
  History,
  Separator,
  TextStyle,
  Separator,
  FontFamily,
  FontSize,
  Separator,
  Bold,
  Italic,
  Underline,
  Strike,
  Code,
  Separator,
  TextColor,
  Highlight,
  Separator,
  Link,
  Separator,
  TextAlign,
  Separator,
  Lists,
  BulletList,
  OrderedList,
  ListItem,
  TaskList,
  Separator,
  Quote,
  CodeBlock,
  Callout,
  Separator,
  Image,
  HorizontalRule,
  PageBreak,
  Separator,
  createPages({
    // Letter is the standard 8.5×11" page in the United States.
    // Switch to A4 (or any other PAGE_FORMATS entry) via the toolbar.
    format: "Letter",
    differentFirstPage: false,
    differentOddEven: false,
    header: '<p style="text-align:center">Pitter Patter Editor</p>',
    footer:
      '<p style="text-align:center">Page <span data-pp-token="pageNumber">{{PAGE_NUMBER}}</span> of <span data-pp-token="totalPages">{{TOTAL_PAGES}}</span></p>',
  }),

  // Schema-only / system extensions
  Heading,
  Typography,
  Gapcursor,
  Dropcursor,
  Placeholder,
  TrailingNode,
  CharacterCount,
  Statistics,
  Focus,
  UniqueID,
  MaintainSelection,
  ColorChip,
  SmartPaste,
  Linkify,
  HoverLink,
  FileHandler,
  SlashMenu,
  Mention,
  Emoji,
] as const);

export { buildInitialDoc } from "./demoDocs/featureTour";
