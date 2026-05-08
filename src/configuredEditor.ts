import type { Schema } from "prosemirror-model";

import { createEditor } from "./editor";
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
  Placeholder,
  PullQuote,
  Quote,
  Redo,
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
  Undo,
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
  Undo,
  Redo,
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
