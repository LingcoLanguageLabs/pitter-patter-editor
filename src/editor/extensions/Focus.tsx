import type { Node } from "prosemirror-model";
import { Plugin } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

import { Extension } from "../types";

export interface FocusOptions {
  /** Class name applied to the focused block decoration. Default: "is-focused". */
  className?: string;
  /**
   * Which ancestor block carries the focus class.
   * - "deepest" (default): the innermost block containing the cursor (e.g.
   *   the paragraph inside a list item).
   * - "shallowest": the topmost block at depth 1 (e.g. the list itself).
   */
  mode?: "deepest" | "shallowest";
}

/**
 * Adds a class to the block containing the current selection. Ships no
 * styling — consumers wire up CSS to e.g. dim non-focused content.
 *
 *   .ProseMirror > * { opacity: 0.4; transition: opacity 200ms; }
 *   .ProseMirror > .is-focused { opacity: 1; }
 */
export function createFocus({
  className = "is-focused",
  mode = "deepest",
}: FocusOptions = {}) {
  return Extension.create({
    name: "focus",
    plugins: () => [
      new Plugin({
        props: {
          decorations(state) {
            const { $from } = state.selection;
            let block: { pos: number; node: Node } | null = null;
            if (mode === "deepest") {
              for (let d = $from.depth; d > 0; d--) {
                const node = $from.node(d);
                if (node.isBlock) {
                  block = { pos: $from.before(d), node };
                  break;
                }
              }
            } else {
              for (let d = 1; d <= $from.depth; d++) {
                const node = $from.node(d);
                if (node.isBlock) {
                  block = { pos: $from.before(d), node };
                  break;
                }
              }
            }
            if (!block) return null;
            return DecorationSet.create(state.doc, [
              Decoration.node(block.pos, block.pos + block.node.nodeSize, {
                class: className,
              }),
            ]);
          },
        },
      }),
    ],
    meta: { label: "Focus", group: "system" },
  });
}

export const Focus = createFocus();
