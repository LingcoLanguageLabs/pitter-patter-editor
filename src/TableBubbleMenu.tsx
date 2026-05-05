import {
  Columns,
  RowsPlusBottom,
  RowsPlusTop,
  TextT,
  Trash,
} from "@phosphor-icons/react";
import {
  addColumnAfter,
  addColumnBefore,
  addRowAfter,
  addRowBefore,
  deleteColumn,
  deleteRow,
  deleteTable,
  toggleHeaderRow,
} from "prosemirror-tables";
import type { EditorState } from "prosemirror-state";

import { CommandItem } from "./editor";
import {
  FloatingMenu,
  Toolbar as ToolbarPrimitive,
  ToolbarGroup,
  ToolbarSeparator,
  TooltipProvider,
} from "./editor/menu";

export function isInsideTable(state: EditorState): boolean {
  for (let d = state.selection.$from.depth; d > 0; d--) {
    const t = state.selection.$from.node(d).type.name;
    if (t === "table_cell" || t === "table_header") return true;
  }
  return false;
}

const shouldShow = (state: EditorState) => isInsideTable(state);

export function TableBubbleMenu() {
  return (
    <TooltipProvider delayDuration={200} skipDelayDuration={300}>
      <FloatingMenu shouldShow={shouldShow} placement="top">
        <ToolbarPrimitive variant="floating">
          <ToolbarGroup>
            <CommandItem command={addRowBefore} tooltip="Add row above">
              <RowsPlusTop size={16} weight="bold" />
            </CommandItem>
            <CommandItem command={addRowAfter} tooltip="Add row below">
              <RowsPlusBottom size={16} weight="bold" />
            </CommandItem>
            <CommandItem command={addColumnBefore} tooltip="Add column before">
              <Columns size={16} weight="bold" style={{ transform: "scaleX(-1)" }} />
            </CommandItem>
            <CommandItem command={addColumnAfter} tooltip="Add column after">
              <Columns size={16} weight="bold" />
            </CommandItem>
          </ToolbarGroup>
          <ToolbarSeparator />
          <ToolbarGroup>
            <CommandItem command={toggleHeaderRow} tooltip="Toggle header row">
              <TextT size={16} weight="bold" />
            </CommandItem>
          </ToolbarGroup>
          <ToolbarSeparator />
          <ToolbarGroup>
            <CommandItem command={deleteRow} tooltip="Delete row">
              <span style={{ fontSize: 11, fontWeight: 700 }}>−R</span>
            </CommandItem>
            <CommandItem command={deleteColumn} tooltip="Delete column">
              <span style={{ fontSize: 11, fontWeight: 700 }}>−C</span>
            </CommandItem>
            <CommandItem command={deleteTable} tooltip="Delete table">
              <Trash size={16} weight="bold" />
            </CommandItem>
          </ToolbarGroup>
        </ToolbarPrimitive>
      </FloatingMenu>
    </TooltipProvider>
  );
}
