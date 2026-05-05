import type { NodeType } from "prosemirror-model";
import type { Command } from "prosemirror-state";

import { Extension } from "../types";

function insertHardBreak(hardBreakType: NodeType): Command {
  return (state, dispatch) => {
    if (dispatch) {
      dispatch(
        state.tr
          .replaceSelectionWith(hardBreakType.create())
          .scrollIntoView(),
      );
    }
    return true;
  };
}

export const HardBreak = Extension.create({
  name: "hard-break",
  commands: {
    "hard-break": (schema) => insertHardBreak(schema.nodes["hard_break"]!),
  },
  keymap: { "Shift-Enter": "hard-break", "Mod-Enter": "hard-break" },
  meta: { label: "Hard break", shortcut: "⇧⏎", group: "block" },
});
