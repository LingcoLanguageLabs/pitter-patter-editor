import { ArrowClockwise } from "@phosphor-icons/react";
import { redo } from "prosemirror-history";

import { CommandItem } from "../menu";
import { Extension } from "../types";

function RedoToolbarItem() {
  return (
    <CommandItem command={redo} tooltip="Redo" shortcut="⌘⇧Z">
      <ArrowClockwise size={18} weight="bold" />
    </CommandItem>
  );
}

export const Redo = Extension.create({
  name: "redo",
  toolbar: RedoToolbarItem,
  meta: { label: "Redo", shortcut: "⌘⇧Z", group: "history", Icon: ArrowClockwise },
});
