import { ArrowCounterClockwise } from "@phosphor-icons/react";
import { undo } from "prosemirror-history";

import { CommandItem } from "../menu";
import { Extension } from "../types";

function UndoToolbarItem() {
  return (
    <CommandItem command={undo} tooltip="Undo" shortcut="⌘Z">
      <ArrowCounterClockwise size={18} weight="bold" />
    </CommandItem>
  );
}

export const Undo = Extension.create({
  name: "undo",
  toolbar: UndoToolbarItem,
  meta: { label: "Undo", shortcut: "⌘Z", group: "history", Icon: ArrowCounterClockwise },
});
