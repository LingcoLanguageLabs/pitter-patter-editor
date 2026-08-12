/**
 * Inline-item rendering injection. Some items add INLINE atom nodes that live
 * inside the stem's paragraphs (Fill Blanks' `blank`). The runtime walker
 * renders the containing paragraph, but an interactive inline node needs the
 * enclosing completer's response state — so the completer provides a renderer
 * here and the walker's inline-item case consumes it. No provider (static
 * preview) → the walker falls back to a plain gap.
 */

import { createContext, useContext, type ReactNode } from "react";

import type { JsonNode } from "../../runtime/shuffleLayout";

export type RenderInlineItem = (node: JsonNode) => ReactNode;

const InlineItemContext = createContext<RenderInlineItem | null>(null);

export const InlineItemProvider = InlineItemContext.Provider;

export function useInlineItemRenderer(): RenderInlineItem | null {
  return useContext(InlineItemContext);
}
