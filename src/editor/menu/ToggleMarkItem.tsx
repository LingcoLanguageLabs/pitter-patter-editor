import { useEditorState } from "@handlewithcare/react-prosemirror";
import { toggleMark } from "prosemirror-commands";
import type { MarkType } from "prosemirror-model";
import type { ReactNode } from "react";

import { isMarkActive } from "../helpers";

import { CommandItem } from "./CommandItem";

interface ToggleMarkItemProps {
  markType: MarkType;
  children: ReactNode;
  title?: string;
  tooltip?: ReactNode;
  shortcut?: string;
}

export function ToggleMarkItem({
  markType,
  children,
  title,
  tooltip,
  shortcut,
}: ToggleMarkItemProps) {
  const editorState = useEditorState();
  const active = isMarkActive(editorState, markType);
  return (
    <CommandItem
      command={toggleMark(markType)}
      active={active}
      title={title}
      tooltip={tooltip}
      shortcut={shortcut}
    >
      {children}
    </CommandItem>
  );
}
