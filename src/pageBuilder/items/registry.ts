/**
 * Item registry — the ONE place every learning item type is listed. Add a type
 * by dropping a folder under `items/` and adding its definition here; the
 * schema, node views, block catalog, insert factory, and runtime completer all
 * read from this registry, so nothing else edits per type.
 *
 * Definitions are stored type-erased (`ItemDefinition<any>`) because the array
 * is heterogeneous; each item keeps its own typed `Def` internally via the
 * serialize → Completer contract.
 */

import type { ComponentType } from "react";

import { audioPromptItem } from "./audioPrompt";
import { categorizationItem } from "./categorization";
import { fillBlanksItem } from "./fillBlanks";
import { hotspotItem } from "./hotspot";
import { labeledImageItem } from "./labeledImage";
import { markTokensItem } from "./markTokens";
import { multipleChoiceItem } from "./multipleChoice";
import { orderingItem } from "./ordering";
import { ratingItem } from "./rating";
import { textPromptItem } from "./textPrompt";
import type {
  ItemCatalogEntry,
  ItemDefinition,
  ItemNodeView,
  ItemSelectionAction,
} from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ITEM_DEFINITIONS: ItemDefinition<any>[] = [
  multipleChoiceItem,
  fillBlanksItem,
  markTokensItem,
  textPromptItem,
  categorizationItem,
  audioPromptItem,
  orderingItem,
  ratingItem,
  hotspotItem,
  labeledImageItem,
];

const byType = new Map(ITEM_DEFINITIONS.map((d) => [d.type, d]));

// Inline atom node types contributed by items (e.g. "blank"), for the walker.
const inlineItemTypes = new Set(
  ITEM_DEFINITIONS.flatMap((d) => d.inlineNodes ?? []),
);

/** The definition for an outer item block type, if any. */
export function getItemDefinition(
  type: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): ItemDefinition<any> | undefined {
  return byType.get(type);
}

/** True for an item's OUTER block type (e.g. "mc"), not its child nodes. */
export function isItemType(type: string): boolean {
  return byType.has(type);
}

/** All item NodeViews merged into one map for `<ProseMirror nodeViewComponents>`. */
export function itemNodeViews(): Record<string, ItemNodeView> {
  const map: Record<string, ItemNodeView> = {};
  for (const def of ITEM_DEFINITIONS) Object.assign(map, def.nodeViews);
  return map;
}

/** Catalog entries for all item types (for the "+ Add block" picker) — each
 *  type's main entry plus any presets (extra rows of the same node type, e.g.
 *  Multiple Choice's "Opinion poll"). */
export function itemCatalogEntries(): ItemCatalogEntry[] {
  return ITEM_DEFINITIONS.flatMap((def) => [
    def.catalog,
    ...(def.catalogPresets ?? []),
  ]);
}

/** Human display label for any item node type (outer block OR a child like
 *  `mc_option`), for the drag-handle pill + Layers panel. Falls back to the
 *  block's catalog label, else undefined (caller derives its own default). */
export function itemNodeLabel(typeName: string): string | undefined {
  for (const def of ITEM_DEFINITIONS) {
    const label = def.nodeLabels?.[typeName];
    if (label) return label;
  }
  return byType.get(typeName)?.catalog.label;
}

/** True for an inline atom node an item contributes (e.g. "blank"). The runtime
 *  walker delegates these to the enclosing completer. */
export function isInlineItemNode(typeName: string): boolean {
  return inlineItemTypes.has(typeName);
}

/** All selection-toolbar actions contributed by items (e.g. "Mark as blank"). */
export function itemSelectionActions(): ItemSelectionAction[] {
  return ITEM_DEFINITIONS.flatMap((d) => d.selectionActions ?? []);
}

/** Selection-driven settings popovers contributed by items (rendered once in
 *  the editor; each shows itself when its selection is active). */
export function itemSelectionPopovers(): ComponentType[] {
  return ITEM_DEFINITIONS.map((d) => d.SelectionPopover).filter(
    (P): P is ComponentType => !!P,
  );
}
