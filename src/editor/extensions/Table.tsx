import {
  Columns,
  Minus,
  RowsPlusBottom,
  RowsPlusTop,
  GridNine as TableIcon,
  TextT,
  Trash,
} from "@phosphor-icons/react";
import type { NodeType, Schema } from "prosemirror-model";
import type { Command } from "prosemirror-state";
import {
  addColumnAfter,
  addColumnBefore,
  addRowAfter,
  addRowBefore,
  deleteColumn,
  deleteRow,
  deleteTable,
  goToNextCell,
  mergeCells,
  splitCell,
  tableEditing,
  tableNodes,
  toggleHeaderColumn,
  toggleHeaderRow,
} from "prosemirror-tables";
import type { CSSProperties } from "react";

import { useEditor } from "../Editor";
import { Dropdown, DropdownItem } from "../menu";
import { Extension } from "../types";

const tableNodeSpecs = tableNodes({
  tableGroup: "block",
  cellContent: "block+",
  cellAttributes: {},
});

export function insertTable(rows: number, cols: number, withHeader: boolean): Command {
  return (state, dispatch) => {
    const schema: Schema = state.schema;
    const tableType = schema.nodes["table"];
    const rowType = schema.nodes["table_row"];
    const cellType = schema.nodes["table_cell"];
    const headerType = schema.nodes["table_header"];
    if (!tableType || !rowType || !cellType || !headerType) return false;

    const buildCell = (type: NodeType) => {
      const cellNode = type.createAndFill();
      if (!cellNode) throw new Error(`Could not create ${type.name}`);
      return cellNode;
    };

    const tableRows = [];
    for (let r = 0; r < rows; r++) {
      const useHeader = withHeader && r === 0;
      const cells = [];
      for (let c = 0; c < cols; c++) {
        cells.push(buildCell(useHeader ? headerType : cellType));
      }
      tableRows.push(rowType.create(null, cells));
    }
    const table = tableType.create(null, tableRows);

    if (dispatch) {
      dispatch(state.tr.replaceSelectionWith(table).scrollIntoView());
    }
    return true;
  };
}

const ITEM_LABEL_STYLE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
};

function TableToolbarItem() {
  const { schema } = useEditor();
  const tableType = schema.nodes["table"];
  if (!tableType) return null;

  return (
    <Dropdown
      label={<TableIcon size={18} weight="bold" />}
      tooltip="Table"
      hideCaret
      triggerStyle={{ width: 30, padding: 0, gap: 0 }}
    >
      <DropdownItem command={insertTable(3, 3, true)}>
        <span style={ITEM_LABEL_STYLE}>
          <TableIcon size={16} weight="bold" />
          Insert 3×3 table
        </span>
      </DropdownItem>
      <DropdownItem command={addRowBefore}>
        <span style={ITEM_LABEL_STYLE}>
          <RowsPlusTop size={16} weight="bold" />
          Add row above
        </span>
      </DropdownItem>
      <DropdownItem command={addRowAfter}>
        <span style={ITEM_LABEL_STYLE}>
          <RowsPlusBottom size={16} weight="bold" />
          Add row below
        </span>
      </DropdownItem>
      <DropdownItem command={addColumnBefore}>
        <span style={ITEM_LABEL_STYLE}>
          <Columns size={16} weight="bold" />
          Add column before
        </span>
      </DropdownItem>
      <DropdownItem command={addColumnAfter}>
        <span style={ITEM_LABEL_STYLE}>
          <Columns size={16} weight="bold" />
          Add column after
        </span>
      </DropdownItem>
      <DropdownItem command={deleteRow}>
        <span style={ITEM_LABEL_STYLE}>
          <Minus size={16} weight="bold" />
          Delete row
        </span>
      </DropdownItem>
      <DropdownItem command={deleteColumn}>
        <span style={ITEM_LABEL_STYLE}>
          <Minus size={16} weight="bold" />
          Delete column
        </span>
      </DropdownItem>
      <DropdownItem command={deleteTable}>
        <span style={ITEM_LABEL_STYLE}>
          <Trash size={16} weight="bold" />
          Delete table
        </span>
      </DropdownItem>
      <DropdownItem command={toggleHeaderRow}>
        <span style={ITEM_LABEL_STYLE}>
          <TextT size={16} weight="bold" />
          Toggle header row
        </span>
      </DropdownItem>
    </Dropdown>
  );
}

export const Table = Extension.create({
  name: "table",
  nodes: {
    table: tableNodeSpecs.table,
    table_row: tableNodeSpecs.table_row,
    table_cell: tableNodeSpecs.table_cell,
    table_header: tableNodeSpecs.table_header,
  },
  commands: {
    addColumnAfter: () => addColumnAfter,
    addColumnBefore: () => addColumnBefore,
    addRowAfter: () => addRowAfter,
    addRowBefore: () => addRowBefore,
    deleteRow: () => deleteRow,
    deleteColumn: () => deleteColumn,
    deleteTable: () => deleteTable,
    mergeCells: () => mergeCells,
    splitCell: () => splitCell,
    toggleHeaderRow: () => toggleHeaderRow,
    toggleHeaderColumn: () => toggleHeaderColumn,
    "table-next-cell": () => goToNextCell(1),
    "table-prev-cell": () => goToNextCell(-1),
  },
  keymap: {
    Tab: "table-next-cell",
    "Shift-Tab": "table-prev-cell",
  },
  plugins: () => [tableEditing()],
  toolbar: TableToolbarItem,
  meta: { label: "Table", group: "block", Icon: TableIcon },
});
