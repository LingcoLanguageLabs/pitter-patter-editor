import { ListBullets } from "@phosphor-icons/react";

import { isAncestorActive, smartListInputRule, toggleList } from "../helpers";
import { Extension } from "../types";

const bulletInputRegex = /^\s*([-+*])\s$/;

export const BulletList = Extension.create({
  name: "bullet-list",
  nodes: {
    bullet_list: {
      content: "list_item+",
      group: "block list",
      parseDOM: [{ tag: "ul" }],
      toDOM() {
        return ["ul", 0];
      },
    },
  },
  commands: {
    "bullet-list": (schema) => toggleList(schema.nodes["bullet_list"]!, schema.nodes["list_item"]!),
  },
  keymap: { "Mod-Shift-8": "bullet-list" },
  inputRules: (schema) => {
    const listType = schema.nodes["bullet_list"];
    if (!listType) return [];
    return [smartListInputRule(bulletInputRegex, listType)];
  },
  isActive: (state, schema) => isAncestorActive(state, schema.nodes["bullet_list"]!),
  meta: { label: "Bullet list", shortcut: "⌘⇧8", group: "block", Icon: ListBullets },
});
