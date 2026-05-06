import { dropCursor } from "prosemirror-dropcursor";

import { Extension } from "../types";

export interface DropcursorOptions {
  color?: string;
  width?: number;
  /**
   * Number of pixels to inset the cursor from the drop point. Useful when
   * the visual gap between blocks is wider than the default 1px cursor
   * suggests.
   */
  class?: string;
}

/**
 * Renders the blue insertion line while dragging text or files into the
 * editor. Pure visual feedback — purely cosmetic but immediately missed
 * when absent.
 */
export function createDropcursor({
  color = "#3b82f6",
  width = 2,
  class: className,
}: DropcursorOptions = {}) {
  return Extension.create({
    name: "dropcursor",
    plugins: () => [dropCursor({ color, width, class: className })],
    meta: { label: "Drop cursor", group: "system" },
  });
}

export const Dropcursor = createDropcursor();
