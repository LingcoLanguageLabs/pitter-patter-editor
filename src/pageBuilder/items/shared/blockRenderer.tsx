/**
 * Completer-side block renderer, injected by the runtime walker via context.
 * An item's stem can hold arbitrary content blocks (paragraph, image, audio,
 * …); the completer renders them by delegating to the SAME runtime walker the
 * rest of the site uses — but it can't import `renderNode` directly (that would
 * cycle: renderNode → registry → items → completer). So `renderNode` provides
 * this renderer and completers consume it.
 */

import { createContext, useContext, type ReactNode } from "react";

import type { JsonNode } from "../../runtime/shuffleLayout";

export type RenderBlocks = (blocks: readonly JsonNode[]) => ReactNode;

const BlockRendererContext = createContext<RenderBlocks | null>(null);

export const BlockRendererProvider = BlockRendererContext.Provider;

/** Render an array of block JSON to React. No provider → renders nothing
 *  (e.g. a completer used outside the runtime walker). */
export function useRenderBlocks(): RenderBlocks {
  return useContext(BlockRendererContext) ?? (() => null);
}
