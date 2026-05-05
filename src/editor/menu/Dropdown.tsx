import { CaretDown } from "@phosphor-icons/react";
import { useEditorEventCallback, useEditorState } from "@handlewithcare/react-prosemirror";
import * as RadixDropdownMenu from "@radix-ui/react-dropdown-menu";
import type { Command } from "prosemirror-state";
import type { CSSProperties, ReactNode } from "react";

import { Tooltip } from "./Tooltip";

interface DropdownProps {
  label: ReactNode;
  triggerStyle?: CSSProperties;
  children: ReactNode;
  title?: string;
  tooltip?: ReactNode;
  shortcut?: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  hideCaret?: boolean;
  triggerActive?: boolean;
}

export function Dropdown({
  label,
  triggerStyle,
  children,
  title,
  tooltip,
  shortcut,
  side = "bottom",
  align = "start",
  hideCaret,
  triggerActive,
}: DropdownProps) {
  const trigger = (
    <RadixDropdownMenu.Trigger asChild>
      <button
        type="button"
        className="pp-menu-item pp-dropdown-trigger"
        style={triggerStyle}
        data-active={triggerActive || undefined}
        title={tooltip ? undefined : title}
      >
        <span className="pp-dropdown-label">{label}</span>
        {!hideCaret && <CaretDown size={10} weight="bold" />}
      </button>
    </RadixDropdownMenu.Trigger>
  );

  return (
    <RadixDropdownMenu.Root>
      {tooltip ? (
        <Tooltip label={tooltip} shortcut={shortcut}>
          {trigger}
        </Tooltip>
      ) : (
        trigger
      )}
      <RadixDropdownMenu.Portal>
        <RadixDropdownMenu.Content
          className="pp-dropdown-menu"
          side={side}
          align={align}
          sideOffset={4}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {children}
        </RadixDropdownMenu.Content>
      </RadixDropdownMenu.Portal>
    </RadixDropdownMenu.Root>
  );
}

interface DropdownItemProps {
  command: Command;
  active?: boolean;
  children: ReactNode;
}

export function DropdownItem({ command, active, children }: DropdownItemProps) {
  const editorState = useEditorState();
  const run = useEditorEventCallback((view) => {
    if (!view) return;
    command(view.state, view.dispatch, view);
    view.focus();
  });
  const disabled = !editorState || !command(editorState);

  return (
    <RadixDropdownMenu.Item
      className="pp-dropdown-item"
      data-active={active || undefined}
      disabled={disabled}
      onSelect={(e) => {
        e.preventDefault();
        run();
      }}
    >
      {children}
    </RadixDropdownMenu.Item>
  );
}
