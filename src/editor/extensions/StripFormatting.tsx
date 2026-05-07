import { Eraser } from "@phosphor-icons/react";
import type { Schema } from "prosemirror-model";
import type { Command } from "prosemirror-state";

import { useEditor } from "../Editor";
import { CommandItem } from "../menu";
import { Extension } from "../types";

export interface StripFormattingOptions {
  /**
   * Also reset block-level formatting (turns headings, quotes, callouts'
   * inner blocks back to paragraphs and clears block attrs like
   * text-align/line-height/dir). Default: false — matches Google Docs'
   * "Clear formatting" which only strips inline marks.
   */
  clearBlocks?: boolean;
}

export function clearFormattingCommand(
  schema: Schema,
  { clearBlocks = false }: StripFormattingOptions = {},
): Command {
  return (state, dispatch) => {
    const { from, to, empty } = state.selection;

    if (empty) {
      // No range — drop any stored marks so the next keystroke is plain.
      if (dispatch) dispatch(state.tr.setStoredMarks(null));
      return true;
    }

    if (dispatch) {
      const tr = state.tr;
      tr.removeMark(from, to);

      if (clearBlocks) {
        const paragraphType = schema.nodes["paragraph"];
        if (paragraphType) {
          state.doc.nodesBetween(from, to, (node, pos) => {
            if (node.isTextblock && node.type !== paragraphType) {
              tr.setNodeMarkup(pos, paragraphType, null);
            }
            return true;
          });
        }
      }
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

function StripFormattingToolbarItem() {
  const { commands } = useEditor();
  const command = commands.get("clearFormatting");
  if (!command) return null;
  return (
    <CommandItem command={command} tooltip="Clear formatting" shortcut="⌘\">
      <Eraser size={18} weight="bold" />
    </CommandItem>
  );
}

export function createStripFormatting(options: StripFormattingOptions = {}) {
  return Extension.create({
    name: "strip-formatting",
    commands: {
      clearFormatting: (schema) => clearFormattingCommand(schema, options),
    },
    keymap: { "Mod-\\": "clearFormatting" },
    toolbar: StripFormattingToolbarItem,
    meta: {
      label: "Clear formatting",
      shortcut: "⌘\\",
      group: "format",
      Icon: Eraser,
    },
  });
}

export const StripFormatting = createStripFormatting();
