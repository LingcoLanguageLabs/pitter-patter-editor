import {
  CheckSquare,
  ListBullets,
  ListNumbers,
  List as ListIcon,
} from "@phosphor-icons/react";
import { useEditorEventCallback, useEditorState } from "@handlewithcare/react-prosemirror";
import { liftListItem, wrapInList } from "prosemirror-schema-list";
import type { Command, EditorState } from "prosemirror-state";
import type { ComponentType } from "react";

import { useEditor } from "../Editor";
import { isAncestorActive, toggleList } from "../helpers";
import { Dropdown, DropdownItem } from "../menu";
import { Extension } from "../types";

function toggleTaskList(
  listType: import("prosemirror-model").NodeType,
  itemType: import("prosemirror-model").NodeType,
): Command {
  return (state, dispatch, view) => {
    const { $from } = state.selection;
    for (let depth = $from.depth; depth > 0; depth--) {
      if ($from.node(depth).type === listType) {
        return liftListItem(itemType)(state, dispatch);
      }
    }
    return wrapInList(listType)(state, dispatch, view);
  };
}

function ListsToolbarItem() {
  const { schema } = useEditor();
  const editorState = useEditorState();
  const bulletType = schema.nodes["bullet_list"];
  const orderedType = schema.nodes["ordered_list"];
  const itemType = schema.nodes["list_item"];
  const taskListType = schema.nodes["task_list"];
  const taskItemType = schema.nodes["task_item"];
  if (!bulletType || !orderedType || !itemType) return null;

  const bulletActive = isAncestorActive(editorState as EditorState | null, bulletType);
  const orderedActive = isAncestorActive(editorState as EditorState | null, orderedType);
  const taskActive =
    !!taskListType && isAncestorActive(editorState as EditorState | null, taskListType);
  const anyActive = bulletActive || orderedActive || taskActive;

  const TriggerIcon: ComponentType<{ size: number; weight: "bold" }> = taskActive
    ? CheckSquare
    : orderedActive
      ? ListNumbers
      : bulletActive
        ? ListBullets
        : ListIcon;

  return (
    <Dropdown
      label={<TriggerIcon size={18} weight="bold" />}
      tooltip="List"
      hideCaret
      triggerStyle={{ width: 30, padding: 0, gap: 0 }}
      triggerActive={anyActive}
    >
      <DropdownItem command={toggleList(bulletType, itemType)} active={bulletActive}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <ListBullets size={16} weight="bold" />
          Bulleted list
        </span>
        <span className="pp-dropdown-shortcut">⌘⇧8</span>
      </DropdownItem>
      <DropdownItem command={toggleList(orderedType, itemType)} active={orderedActive}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <ListNumbers size={16} weight="bold" />
          Numbered list
        </span>
        <span className="pp-dropdown-shortcut">⌘⇧7</span>
      </DropdownItem>
      {taskListType && taskItemType && (
        <DropdownItem
          command={toggleTaskList(taskListType, taskItemType)}
          active={taskActive}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <CheckSquare size={16} weight="bold" />
            Task list
          </span>
          <span className="pp-dropdown-shortcut">⌘⇧9</span>
        </DropdownItem>
      )}
    </Dropdown>
  );
}

export const Lists = Extension.create({
  name: "lists",
  toolbar: ListsToolbarItem,
  meta: { label: "List", group: "block", Icon: ListIcon },
});
