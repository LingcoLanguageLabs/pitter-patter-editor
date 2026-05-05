import { CheckSquare } from "@phosphor-icons/react";
import { InputRule } from "prosemirror-inputrules";
import type { Node as PmNode, NodeType, Schema } from "prosemirror-model";
import {
  liftListItem,
  sinkListItem,
  splitListItem,
  wrapInList,
} from "prosemirror-schema-list";
import { Plugin } from "prosemirror-state";
import type { Command } from "prosemirror-state";
import { canJoin, findWrapping } from "prosemirror-transform";
import type { EditorView, NodeView, ViewMutationRecord } from "prosemirror-view";

import { isAncestorActive } from "../helpers";
import { Extension } from "../types";

function toggleTaskList(listType: NodeType, itemType: NodeType): Command {
  return (state, dispatch, view) => {
    const { $from } = state.selection;

    let inTaskList = false;
    let otherListInfo: { pos: number } | null = null;

    for (let depth = $from.depth; depth > 0; depth--) {
      const node = $from.node(depth);
      if (node.type === listType) {
        inTaskList = true;
        break;
      }
      if (node.type.spec.group?.includes("list")) {
        otherListInfo = { pos: $from.before(depth) };
      }
    }

    if (inTaskList) {
      // We're inside a task_list. The enclosing item is task_item, but
      // liftListItem expects an item type — task_item shares the same
      // "paragraph block*" content shape as list_item, so it lifts cleanly.
      return liftListItem(itemType)(state, dispatch);
    }
    if (otherListInfo) {
      // Re-tag the existing list as a task_list. Items inside still have
      // list_item shape, so we also need to convert each child to task_item.
      // Simplest correct path: lift out of the existing list, then wrap in task_list.
      return false;
    }
    return wrapInList(listType)(state, dispatch, view);
  };
}

const taskInputRegex = /^\s*\[([ xX])\]\s$/;

function taskInputRule(listType: NodeType, itemType: NodeType): InputRule {
  return new InputRule(taskInputRegex, (state, match, start, end) => {
    const checked = match[1] !== " ";
    const $start = state.doc.resolve(start);

    // If we're already inside a list, ignore (let the user just type).
    for (let depth = $start.depth; depth > 0; depth--) {
      const node = $start.node(depth);
      if (node.type.spec.group?.includes("list")) {
        return null;
      }
    }

    const tr = state.tr.delete(start, end);
    const range = tr.doc.resolve(start).blockRange();
    if (!range) return null;
    const wrapping = findWrapping(range, listType);
    if (!wrapping) return null;
    tr.wrap(range, wrapping);

    // After the wrap, the task_item attrs default to { checked: false }.
    // If the rule matched [x], flip the freshly-wrapped item's `checked` attr.
    if (checked) {
      const listPos = start - 1;
      const list = tr.doc.nodeAt(listPos);
      if (list && list.firstChild && list.firstChild.type === itemType) {
        const itemPos = listPos + 1;
        tr.setNodeMarkup(itemPos, undefined, { ...list.firstChild.attrs, checked: true });
      }
    }

    // Try to join with a preceding task_list of the same type.
    const before = tr.doc.resolve(start - 1).nodeBefore;
    if (before && before.type === listType && canJoin(tr.doc, start - 1)) {
      tr.join(start - 1);
    }
    return tr;
  });
}

class TaskItemNodeView implements NodeView {
  dom: HTMLLIElement;
  contentDOM: HTMLDivElement;
  private checkbox: HTMLInputElement;
  private node: PmNode;

  constructor(node: PmNode, view: EditorView, getPos: () => number | undefined) {
    this.node = node;

    const li = document.createElement("li");
    li.setAttribute("data-type", "task-item");
    li.setAttribute("data-checked", String(node.attrs["checked"]));

    const label = document.createElement("label");
    label.contentEditable = "false";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = !!node.attrs["checked"];
    checkbox.addEventListener("change", () => {
      const pos = getPos();
      if (pos === undefined) return;
      const currentNode = view.state.doc.nodeAt(pos);
      if (!currentNode) return;
      view.dispatch(
        view.state.tr.setNodeMarkup(pos, undefined, {
          ...currentNode.attrs,
          checked: !currentNode.attrs["checked"],
        }),
      );
    });
    label.appendChild(checkbox);

    const contentDOM = document.createElement("div");

    li.appendChild(label);
    li.appendChild(contentDOM);

    this.dom = li;
    this.contentDOM = contentDOM;
    this.checkbox = checkbox;
  }

  update(node: PmNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.dom.setAttribute("data-checked", String(node.attrs["checked"]));
    if (this.checkbox.checked !== !!node.attrs["checked"]) {
      this.checkbox.checked = !!node.attrs["checked"];
    }
    return true;
  }

  stopEvent(event: Event): boolean {
    // Don't let ProseMirror try to handle input events on the checkbox.
    return event.target === this.checkbox;
  }

  ignoreMutation(mutation: ViewMutationRecord): boolean {
    if (mutation.type === "selection") return false;
    // Mutations inside the label (checkbox toggling) shouldn't affect PM.
    return !this.contentDOM.contains(mutation.target);
  }
}

function taskItemNodeViewPlugin(schema: Schema): Plugin {
  const taskItemType = schema.nodes["task_item"];
  if (!taskItemType) {
    return new Plugin({});
  }
  return new Plugin({
    props: {
      nodeViews: {
        task_item: (node, view, getPos) => new TaskItemNodeView(node, view, getPos),
      },
    },
  });
}

export const TaskList = Extension.create({
  name: "task-list",
  nodes: {
    task_list: {
      content: "task_item+",
      group: "block list",
      parseDOM: [{ tag: "ul[data-type='task-list']", priority: 51 }],
      toDOM: () => ["ul", { "data-type": "task-list" }, 0],
    },
    task_item: {
      attrs: { checked: { default: false } },
      content: "paragraph block*",
      defining: true,
      parseDOM: [
        {
          tag: "li[data-type='task-item']",
          getAttrs: (dom) => ({
            checked: (dom as HTMLElement).getAttribute("data-checked") === "true",
          }),
        },
      ],
      toDOM: (node) => [
        "li",
        { "data-type": "task-item", "data-checked": String(node.attrs["checked"]) },
        [
          "label",
          ["input", { type: "checkbox", ...(node.attrs["checked"] ? { checked: "" } : {}) }],
        ],
        ["div", 0],
      ],
    },
  },
  commands: {
    "task-list-toggle": (schema) =>
      toggleTaskList(schema.nodes["task_list"]!, schema.nodes["task_item"]!),
    "task-item-split": (schema) => splitListItem(schema.nodes["task_item"]!),
    "task-item-sink": (schema) => sinkListItem(schema.nodes["task_item"]!),
    "task-item-lift": (schema) => liftListItem(schema.nodes["task_item"]!),
  },
  keymap: {
    "Mod-Shift-9": "task-list-toggle",
    Enter: "task-item-split",
    Tab: "task-item-sink",
    "Shift-Tab": "task-item-lift",
  },
  inputRules: (schema) => {
    const listType = schema.nodes["task_list"];
    const itemType = schema.nodes["task_item"];
    if (!listType || !itemType) return [];
    return [taskInputRule(listType, itemType)];
  },
  plugins: (schema) => [taskItemNodeViewPlugin(schema)],
  isActive: (state, schema) => isAncestorActive(state, schema.nodes["task_list"]!),
  meta: { label: "Task list", shortcut: "⌘⇧9", group: "block", Icon: CheckSquare },
});
