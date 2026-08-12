/**
 * Page-builder implementation of the builder tools injected into item node
 * views (see `items/shared/blockTools`). Lives OUTSIDE the item folder, so it
 * can use the block catalog + factory + picker without the item-registry import
 * cycle. Provided once in `Editor.tsx`.
 */

import { useEditorEventCallback } from "@handlewithcare/react-prosemirror";
import { Plus } from "@phosphor-icons/react";

import { BlockPicker } from "./blocks/BlockPicker";
import { BLOCK_CATALOG, type BlockCatalogEntry } from "./blocks/catalog";
import { createBlockNode } from "./blocks/createBlock";
import type {
  AddContentBlockProps,
  ItemBuilderTools,
} from "./items/shared/blockTools";
import { isUnsplashEntry, unsplashOpenInsert } from "./unsplashPicker";

// Blocks offered inside a question stem: content only — no layout containers
// (Section/Card/Container/Row) and no nested question items.
const STEM_CATALOG: BlockCatalogEntry[] = BLOCK_CATALOG.filter(
  (e) => e.group === "Basic" || e.group === "Media",
);

function AddContentBlock({
  getContainerPos,
  className,
  label = "Add content",
}: AddContentBlockProps) {
  const insert = useEditorEventCallback((view, entry: BlockCatalogEntry) => {
    const pos = getContainerPos();
    if (pos == null) return;
    const container = view.state.doc.nodeAt(pos);
    if (!container) return;
    // Insert just before the container's closing token (end of its content).
    const at = pos + container.nodeSize - 1;
    // Unsplash opens the picker targeting this spot instead of inserting now.
    if (isUnsplashEntry(entry)) {
      unsplashOpenInsert(at)(view.state, view.dispatch);
      return;
    }
    view.dispatch(
      view.state.tr
        .insert(at, createBlockNode(view.state.schema, entry))
        .scrollIntoView(),
    );
  });

  return (
    <BlockPicker
      catalog={STEM_CATALOG}
      onPick={insert}
      side="bottom"
      trigger={
        <button
          type="button"
          contentEditable={false}
          className={className}
          onMouseDown={(e) => e.preventDefault()}
        >
          <Plus size={13} weight="bold" /> {label}
        </button>
      }
    />
  );
}

export const itemBuilderTools: ItemBuilderTools = { AddContentBlock };
