import { ListNumbers } from "@phosphor-icons/react";

import { isAncestorActive, smartListInputRule, toggleList } from "../helpers";
import { Extension } from "../types";

const orderedInputRegex = /^(\d+)\.\s$/;

export const OrderedList = Extension.create({
  name: "ordered-list",
  nodes: {
    ordered_list: {
      attrs: { order: { default: 1 } },
      content: "list_item+",
      group: "block list",
      parseDOM: [
        {
          tag: "ol",
          getAttrs(dom) {
            const start = (dom as HTMLElement).getAttribute("start");
            return { order: start ? Number(start) : 1 };
          },
        },
      ],
      toDOM(node) {
        return node.attrs["order"] === 1 ? ["ol", 0] : ["ol", { start: node.attrs["order"] }, 0];
      },
    },
  },
  commands: {
    "ordered-list": (schema) =>
      toggleList(schema.nodes["ordered_list"]!, schema.nodes["list_item"]!),
  },
  keymap: { "Mod-Shift-7": "ordered-list" },
  inputRules: (schema) => {
    const listType = schema.nodes["ordered_list"];
    if (!listType) return [];
    return [
      smartListInputRule(
        orderedInputRegex,
        listType,
        (match) => ({ order: Number(match[1]) }),
        (match, node) => node.childCount + Number(node.attrs["order"]) === Number(match[1]),
      ),
    ];
  },
  isActive: (state, schema) => isAncestorActive(state, schema.nodes["ordered_list"]!),
  meta: { label: "Ordered list", shortcut: "⌘⇧7", group: "block", Icon: ListNumbers },
});
