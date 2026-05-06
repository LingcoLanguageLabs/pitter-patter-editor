import { Plugin, PluginKey } from "prosemirror-state";

import { Extension } from "../types";

export interface TrailingNodeOptions {
  /** Node type appended to the end of the doc. Default: "paragraph". */
  nodeName?: string;
  /**
   * Names of node types that should *not* trigger a trailing-node append.
   * If the doc's last child is one of these, no paragraph is added.
   * Default: ["paragraph"] — so a doc already ending in a paragraph isn't
   * doubled.
   */
  notAfter?: string[];
}

const trailingNodeKey = new PluginKey("pp-trailing-node");

export function createTrailingNode({
  nodeName = "paragraph",
  notAfter = ["paragraph"],
}: TrailingNodeOptions = {}) {
  return Extension.create({
    name: "trailing-node",
    plugins: (schema) => {
      const trailingType = schema.nodes[nodeName];
      if (!trailingType) return [];
      const notAfterSet = new Set(notAfter);
      return [
        new Plugin({
          key: trailingNodeKey,
          appendTransaction(_transactions, _oldState, newState) {
            const { doc, tr } = newState;
            const lastChild = doc.lastChild;
            if (!lastChild) return null;
            if (notAfterSet.has(lastChild.type.name)) return null;
            return tr.insert(doc.content.size, trailingType.create());
          },
        }),
      ];
    },
    meta: { label: "Trailing node", group: "system" },
  });
}

export const TrailingNode = createTrailingNode();
