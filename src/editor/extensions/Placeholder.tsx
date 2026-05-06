import type { Node } from "prosemirror-model";
import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

import { Extension } from "../types";

export interface PlaceholderOptions {
  /**
   * Text shown inside an empty textblock. May be a string or a function
   * that receives the empty node — return an empty string to skip a given
   * node type.
   */
  placeholder?: string | ((node: Node) => string);
  /**
   * If true (default), the placeholder is only rendered in the empty
   * textblock that currently contains the cursor. If false, it renders
   * in every empty textblock.
   */
  showOnlyCurrent?: boolean;
  /** CSS class applied to the empty block decoration. */
  className?: string;
}

const placeholderKey = new PluginKey("pp-placeholder");

export function createPlaceholder({
  placeholder = "Type / for commands",
  showOnlyCurrent = true,
  className = "pp-empty-block",
}: PlaceholderOptions = {}) {
  return Extension.create({
    name: "placeholder",
    plugins: () => [
      new Plugin({
        key: placeholderKey,
        props: {
          decorations(state) {
            const { selection, doc } = state;
            const decorations: Decoration[] = [];
            doc.descendants((node, pos) => {
              if (!node.isTextblock) return;
              if (node.content.size > 0) return false;
              const text =
                typeof placeholder === "function" ? placeholder(node) : placeholder;
              if (!text) return false;
              const isCurrent =
                selection.from >= pos && selection.from <= pos + node.nodeSize;
              if (showOnlyCurrent && !isCurrent) return false;
              decorations.push(
                Decoration.node(pos, pos + node.nodeSize, {
                  class: className,
                  "data-placeholder": text,
                }),
              );
              return false;
            });
            return DecorationSet.create(doc, decorations);
          },
        },
      }),
    ],
    meta: { label: "Placeholder", group: "system" },
  });
}

export const Placeholder = createPlaceholder();
