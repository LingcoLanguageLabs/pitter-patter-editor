import type { Node } from "prosemirror-model";
import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

import { Extension } from "../types";

// Hex colors followed by a word boundary (whitespace, punctuation, or
// end-of-text). The lookahead avoids matching mid-token nonsense.
const HEX_COLOR = /(#[0-9a-f]{3}(?:[0-9a-f]{3})?)(?=\s|[,.;:)\]!?]|$)/gi;

function findColors(doc: Node, className: string): DecorationSet {
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text || !node.text.includes("#")) return;
    HEX_COLOR.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = HEX_COLOR.exec(node.text)) !== null) {
      const color = match[1]!;
      const from = pos + match.index;
      const to = from + color.length;
      decorations.push(
        Decoration.inline(from, to, {
          class: className,
          style: `--pp-chip-color: ${color}`,
        }),
      );
    }
  });
  return DecorationSet.create(doc, decorations);
}

const colorChipKey = new PluginKey<DecorationSet>("pp-color-chip");

export interface ColorChipOptions {
  /** CSS class applied to each detected hex code. Default: "pp-color-chip". */
  className?: string;
}

/**
 * Inline decoration plugin that paints a small colored swatch next to any
 * hex color (`#fff`, `#aabbcc`) that appears in the doc text. Pure visual
 * — doesn't change the schema, doesn't store anything, just decorates.
 */
export function createColorChip({
  className = "pp-color-chip",
}: ColorChipOptions = {}) {
  return Extension.create({
    name: "color-chip",
    plugins: () => [
      new Plugin<DecorationSet>({
        key: colorChipKey,
        state: {
          init: (_, state) => findColors(state.doc, className),
          apply: (tr, prev) =>
            tr.docChanged ? findColors(tr.doc, className) : prev,
        },
        props: {
          decorations(state) {
            return colorChipKey.getState(state) ?? null;
          },
        },
      }),
    ],
    meta: { label: "Color chip", group: "system" },
  });
}

export const ColorChip = createColorChip();
