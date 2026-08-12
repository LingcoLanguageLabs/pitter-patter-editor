/**
 * Table toolbar — a floating row of table controls that appears whenever the
 * selection sits inside a table, anchored above the table. The page-builder twin
 * of the base editor's `TableBubbleMenu`, built on the same floating-ui + portal
 * pattern as `TextSelectionToolbar` (and reusing its `pb-text-toolbar` styling)
 * so it matches the rest of the chrome.
 *
 * This is the home for the row/column/header operations (prosemirror-tables
 * commands) — they live here rather than in the block-settings panel because
 * clicking a cell makes the cell's paragraph the "active block", so the panel
 * would show the paragraph's form, not the table's. The toolbar keys off "is the
 * cursor in a table" instead, so the controls are always reachable while editing.
 */

"use client";

import {
  autoUpdate,
  flip,
  offset,
  shift,
  useFloating,
} from "@floating-ui/react";
import {
  useEditorEffect,
  useEditorEventCallback,
  useEditorState,
} from "@handlewithcare/react-prosemirror";
import { Columns, RowsPlusBottom, RowsPlusTop, TextT, Trash } from "@phosphor-icons/react";
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
import type { Command, EditorState } from "prosemirror-state";
import { useMemo, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { Tooltip, TooltipProvider } from "../editor/menu";

/** Position of the enclosing `table` node, or null when the selection isn't in
 *  one. Memoized per editor state so the anchor effect doesn't loop. */
function tablePos(state: EditorState): number | null {
  const $from = state.selection.$from;
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name === "table") return $from.before(d);
  }
  return null;
}

export function TableToolbar() {
  const editorState = useEditorState();
  const pos = useMemo(() => tablePos(editorState), [editorState]);

  const { refs, floatingStyles } = useFloating({
    placement: "top",
    middleware: [offset(8), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  // Anchor to the table's DOM (the `.tableWrapper` columnResizing wraps it in,
  // falling back to the node DOM). Keyed on `pos` so it only re-anchors when the
  // selection enters a different table — the same loop-avoidance as the text
  // toolbar's anchor effect.
  useEditorEffect(
    (view) => {
      if (pos == null) return;
      const dom = view.nodeDOM(pos);
      const el =
        dom instanceof HTMLElement ? (dom.closest(".tableWrapper") ?? dom) : null;
      if (el) {
        refs.setReference({
          getBoundingClientRect: () => el.getBoundingClientRect(),
          contextElement: el,
        });
      }
    },
    [pos, refs],
  );

  const run = useEditorEventCallback((view, cmd: Command) => {
    cmd(view.state, view.dispatch);
    view.focus();
  });

  if (pos == null) return null;

  return createPortal(
    <div
      ref={refs.setFloating}
      className="pb-text-toolbar-anchor"
      style={floatingStyles}
    >
      <div
        className="pb-text-toolbar"
        data-open
        onMouseDown={(event) => event.preventDefault()}
      >
        <TooltipProvider delayDuration={200} skipDelayDuration={300}>
          <TableTool label="Add row above" onClick={() => run(addRowBefore)}>
            <RowsPlusTop size={16} weight="bold" />
          </TableTool>
          <TableTool label="Add row below" onClick={() => run(addRowAfter)}>
            <RowsPlusBottom size={16} weight="bold" />
          </TableTool>
          <TableTool label="Add column before" onClick={() => run(addColumnBefore)}>
            <Columns size={16} weight="bold" style={{ transform: "scaleX(-1)" }} />
          </TableTool>
          <TableTool label="Add column after" onClick={() => run(addColumnAfter)}>
            <Columns size={16} weight="bold" />
          </TableTool>

          <span className="pb-text-toolbar-separator" aria-hidden />

          <TableTool label="Toggle header row" onClick={() => run(toggleHeaderRow)}>
            <TextT size={16} weight="bold" />
          </TableTool>

          <span className="pb-text-toolbar-separator" aria-hidden />

          <TableTool label="Delete row" onClick={() => run(deleteRow)}>
            <span className="pb-table-tool-glyph">−R</span>
          </TableTool>
          <TableTool label="Delete column" onClick={() => run(deleteColumn)}>
            <span className="pb-table-tool-glyph">−C</span>
          </TableTool>
          <TableTool label="Delete table" onClick={() => run(deleteTable)}>
            <Trash size={16} weight="bold" />
          </TableTool>
        </TooltipProvider>
      </div>
    </div>,
    document.body,
  );
}

function TableTool({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip label={label}>
      <button type="button" className="pb-text-tool" onClick={onClick} aria-label={label}>
        {children}
      </button>
    </Tooltip>
  );
}
