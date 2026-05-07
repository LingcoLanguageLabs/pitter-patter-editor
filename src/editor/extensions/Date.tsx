import { CalendarBlank } from "@phosphor-icons/react";
import {
  useEditorEventCallback,
  useEditorState,
} from "@handlewithcare/react-prosemirror";
import * as RadixPopover from "@radix-ui/react-popover";
import type { NodeSpec, NodeType } from "prosemirror-model";
import {
  NodeSelection,
  type Command,
  type EditorState,
} from "prosemirror-state";
import { useState } from "react";

import { useEditor } from "../Editor";
import { MenuItem } from "../menu/MenuItem";
import { Extension } from "../types";

const DEFAULT_FORMAT: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
};

function formatDate(iso: string): string {
  if (!iso) return "date";
  // Treat the value as a calendar date (no timezone shift).
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString(undefined, {
    ...DEFAULT_FORMAT,
    timeZone: "UTC",
  });
}

const dateSpec: NodeSpec = {
  inline: true,
  group: "inline",
  atom: true,
  selectable: true,
  draggable: false,
  attrs: { value: { default: "" } },
  parseDOM: [
    {
      tag: "time[data-pp-date]",
      getAttrs(dom) {
        if (!(dom instanceof HTMLElement)) return false;
        return {
          value:
            dom.getAttribute("datetime") ??
            dom.getAttribute("data-pp-date") ??
            "",
        };
      },
    },
  ],
  toDOM(node) {
    const value = (node.attrs["value"] as string) || "";
    const display = formatDate(value);
    return [
      "time",
      {
        "data-pp-date": value,
        datetime: value,
        class: "pp-date",
      },
      display,
    ];
  },
};

function isDateSelected(state: EditorState | null, type: NodeType): boolean {
  if (!state) return false;
  const { selection } = state;
  return selection instanceof NodeSelection && selection.node.type === type;
}

function insertDate(type: NodeType, value: string): Command {
  return (state, dispatch) => {
    if (!value) return false;
    if (dispatch) {
      dispatch(
        state.tr
          .replaceSelectionWith(type.create({ value }), false)
          .scrollIntoView(),
      );
    }
    return true;
  };
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function DateToolbarItem() {
  const { schema } = useEditor();
  const editorState = useEditorState();
  const dateType = schema.nodes["date"];
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(todayIso());

  const insert = useEditorEventCallback((view, iso: string) => {
    if (!view || !dateType) return;
    insertDate(dateType, iso)(view.state, view.dispatch);
    view.focus();
  });

  if (!dateType) return null;
  const active = isDateSelected(editorState, dateType);

  return (
    <RadixPopover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setValue(todayIso());
      }}
    >
      <RadixPopover.Trigger asChild>
        <MenuItem active={active} tooltip="Insert date">
          <CalendarBlank size={18} weight="bold" />
        </MenuItem>
      </RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          className="pp-popover pp-image-popover"
          side="bottom"
          align="start"
          sideOffset={6}
        >
          <form
            className="pp-image-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!value) return;
              insert(value);
              setOpen(false);
            }}
          >
            <label className="pp-popover-label">Date</label>
            <input
              type="date"
              className="pp-popover-input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
            />
            <div className="pp-image-actions">
              <button
                type="button"
                className="pp-popover-btn"
                onClick={() => {
                  insert(todayIso());
                  setOpen(false);
                }}
              >
                Today
              </button>
              <button
                type="submit"
                className="pp-popover-btn pp-popover-btn-primary"
              >
                Insert
              </button>
            </div>
          </form>
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}

export const DateExtension = Extension.create({
  name: "date",
  nodes: { date: dateSpec },
  isActive: (state, schema) => isDateSelected(state, schema.nodes["date"]!),
  toolbar: DateToolbarItem,
  meta: { label: "Date", group: "block", Icon: CalendarBlank },
});

export { DateExtension as Date };
