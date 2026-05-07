import type { Schema } from "prosemirror-model";

import { createEditor } from "./editor";
import {
  Anchor,
  Audio,
  Bold,
  BulletList,
  Callout,
  CharacterCount,
  Code,
  CodeBlock,
  ColorChip,
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
  Placeholder,
  PullQuote,
  Quote,
  Redo,
  Separator,
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
  Undo,
  UniqueID,
  Variables,
  Video,
  YouTube,
} from "./editor/extensions";

// Toolbar order is Google Docs-flavored: history → style → font → inline marks
// → color → link → align → lists → block formatters → insert blocks →
// formatting tools → niche/sub-sup/language. Earlier-in-array means
// higher-priority and stays visible longer; later items are first to land in
// the overflow popover when the toolbar is narrow.
export const editor = createEditor([
  // History
  Undo,
  Redo,
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

export { buildInitialDoc } from "./demoDocs/featureTour";
