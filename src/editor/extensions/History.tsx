import { ArrowClockwise, ArrowCounterClockwise } from "@phosphor-icons/react";
import { history, redo, undo } from "prosemirror-history";

import { CommandItem } from "../menu";
import { Extension } from "../types";

/**
 * History extension — installs the prosemirror-history plugin plus
 * undo/redo commands and the standard keyboard shortcuts:
 *   ⌘Z         → undo
 *   ⌘Y / ⌘⇧Z   → redo
 *
 * Toolbar renders both buttons next to each other.
 */
function HistoryToolbarItem() {
  return (
    <>
      <CommandItem command={undo} tooltip="Undo" shortcut="⌘Z">
        <ArrowCounterClockwise size={18} weight="bold" />
      </CommandItem>
      <CommandItem command={redo} tooltip="Redo" shortcut="⌘⇧Z">
        <ArrowClockwise size={18} weight="bold" />
      </CommandItem>
    </>
  );
}

export const History = Extension.create({
  name: "history",
  plugins: () => [history()],
  commands: {
    undo: () => undo,
    redo: () => redo,
  },
  keymap: {
    "Mod-z": "undo",
    "Mod-y": "redo",
    "Shift-Mod-z": "redo",
  },
  toolbar: HistoryToolbarItem,
  meta: {
    label: "History",
    group: "history",
    Icon: ArrowCounterClockwise,
  },
});
