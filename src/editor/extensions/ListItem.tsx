import { liftListItem, sinkListItem } from "prosemirror-schema-list";

import { smartSplitListItem } from "../helpers";
import { Extension } from "../types";

export const ListItem = Extension.create({
  name: "list-item",
  nodes: {
    list_item: {
      content: "paragraph block*",
      defining: true,
      parseDOM: [{ tag: "li" }],
      toDOM() {
        return ["li", 0];
      },
    },
  },
  commands: {
    "list-item-split": (schema) => smartSplitListItem(schema.nodes["list_item"]!),
    "list-item-sink": (schema) => sinkListItem(schema.nodes["list_item"]!),
    "list-item-lift": (schema) => liftListItem(schema.nodes["list_item"]!),
  },
  keymap: {
    Enter: "list-item-split",
    Tab: "list-item-sink",
    "Shift-Tab": "list-item-lift",
  },
});
