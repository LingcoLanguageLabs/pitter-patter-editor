/**
 * Builder-side tools the page builder injects into item node views via context.
 * Items live as leaves (they must NOT import the page-builder's block
 * catalog/factory/schema — those loop back through the item registry), so the
 * page builder provides an `AddContentBlock` control instead. Any item whose
 * stem/content is a block container uses it to offer "+ Add content".
 */

import { createContext, useContext, type ComponentType } from "react";

export interface AddContentBlockProps {
  /** Live getter for the block-container node's start position (e.g. an item's
   *  stem). The control inserts the chosen block at the END of its content. */
  getContainerPos: () => number | null | undefined;
  className?: string;
  label?: string;
}

export interface ItemBuilderTools {
  /** A "+ Add content" picker (text / heading / image / audio / video / lists)
   *  that inserts into a block container. Implemented by the page builder. */
  AddContentBlock: ComponentType<AddContentBlockProps>;
}

const ItemBuilderToolsContext = createContext<ItemBuilderTools | null>(null);

export const ItemBuilderToolsProvider = ItemBuilderToolsContext.Provider;

export function useItemBuilderTools(): ItemBuilderTools | null {
  return useContext(ItemBuilderToolsContext);
}
