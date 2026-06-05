/**
 * Block catalog — what shows up in the "+ Add block" popover. Modelled
 * on pagy's `src/editor/blocks/catalog.tsx` (the unminified `iE`),
 * trimmed to the node types pitter-patter's ProseMirror schema actually
 * supports today (see `schema.ts` + the basic / list schemas).
 *
 * Each entry carries the user-visible `name`, the `type` used to look
 * the node up on the schema, an icon component, and the picker `group`.
 * The picker renders them grouped + searchable, same as pagy.
 *
 * New schema nodes get added here when they're wired in — don't insert
 * a block here without a corresponding `schema.nodes[type]` factory or
 * the insert will throw at insertion time.
 */

import type { ComponentType } from "react";
import {
  TextT,
  TextHOne,
  TextHTwo,
  TextHThree,
  TextHFour,
  ListBullets,
  ListNumbers,
  Cursor,
  Image as ImageIcon,
  StackSimple,
  Layout,
  Rows,
} from "@phosphor-icons/react";

export type BlockGroup = "Basic" | "Media" | "Layout";

export interface BlockCatalogEntry {
  /** Label shown in the picker. */
  name: string;
  /** ProseMirror node type name. Must exist on the schema. */
  type: string;
  /** Icon rendered next to the row. */
  icon: ComponentType<{ size?: number; weight?: any }>;
  /** Picker category. */
  group: BlockGroup;
  /** Optional attrs to set when creating the node (e.g. heading level). */
  attrs?: Record<string, unknown>;
  /** If true, hidden from the grid — only reachable via the search input. */
  searchOnly?: boolean;
}

export const BLOCK_CATALOG: BlockCatalogEntry[] = [
  // Basic
  { name: "Paragraph", type: "paragraph", icon: TextT, group: "Basic" },
  {
    name: "Heading",
    type: "heading",
    icon: TextHOne,
    group: "Basic",
    attrs: { level: 1 },
  },
  {
    name: "Heading 2",
    type: "heading",
    icon: TextHTwo,
    group: "Basic",
    attrs: { level: 2 },
    searchOnly: true,
  },
  {
    name: "Heading 3",
    type: "heading",
    icon: TextHThree,
    group: "Basic",
    attrs: { level: 3 },
    searchOnly: true,
  },
  {
    name: "Heading 4",
    type: "heading",
    icon: TextHFour,
    group: "Basic",
    attrs: { level: 4 },
    searchOnly: true,
  },
  {
    name: "Bulleted list",
    type: "bullet_list",
    icon: ListBullets,
    group: "Basic",
  },
  {
    name: "Numbered list",
    type: "ordered_list",
    icon: ListNumbers,
    group: "Basic",
  },
  { name: "Button", type: "button", icon: Cursor, group: "Basic" },

  // Media
  { name: "Image", type: "image", icon: ImageIcon, group: "Media" },

  // Layout
  { name: "Row", type: "row", icon: Rows, group: "Layout" },
  {
    name: "Container",
    type: "container",
    icon: StackSimple,
    group: "Layout",
  },
  { name: "Section", type: "section", icon: Layout, group: "Layout" },
];

export const BLOCK_GROUPS: BlockGroup[] = ["Basic", "Media", "Layout"];
