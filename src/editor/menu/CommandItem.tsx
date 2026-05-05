import { useEditorEventCallback, useEditorState } from "@handlewithcare/react-prosemirror";
import type { Command } from "prosemirror-state";
import type { ReactNode } from "react";

import { MenuItem } from "./MenuItem";

interface CommandItemProps {
  command: Command;
  active?: boolean;
  children: ReactNode;
  title?: string;
  tooltip?: ReactNode;
  shortcut?: string;
}

export function CommandItem({
  command,
  active,
  children,
  title,
  tooltip,
  shortcut,
}: CommandItemProps) {
  const onClick = useEditorEventCallback((view) => {
    if (!view) return;
    command(view.state, view.dispatch, view);
    view.focus();
  });

  const editorState = useEditorState();
  const disabled = !editorState || !command(editorState);

  return (
    <MenuItem
      active={active}
      onClick={onClick}
      disabled={disabled}
      title={title}
      tooltip={tooltip}
      shortcut={shortcut}
    >
      {children}
    </MenuItem>
  );
}
