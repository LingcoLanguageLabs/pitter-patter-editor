import { LinkSimple } from "@phosphor-icons/react";
import {
  useEditorEventCallback,
  useEditorState,
} from "@handlewithcare/react-prosemirror";
import * as RadixPopover from "@radix-ui/react-popover";
import { toggleMark } from "prosemirror-commands";
import type { MarkType } from "prosemirror-model";
import { schema as basicSchema } from "prosemirror-schema-basic";
import { Plugin } from "prosemirror-state";
import type { Command, EditorState } from "prosemirror-state";
import { useEffect, useRef, useState } from "react";

import { useEditor } from "../Editor";
import { isMarkActive } from "../helpers";
import { MenuItem } from "../menu/MenuItem";
import { Extension } from "../types";

const linkSpec = basicSchema.spec.marks.get("link");
if (!linkSpec) throw new Error("link mark missing from basic schema");

export function getActiveHref(state: EditorState | null, markType: MarkType): string | null {
  if (!state) return null;
  const { from, to, empty, $from } = state.selection;
  if (empty) {
    const marks = state.storedMarks ?? $from.marks();
    const m = marks.find((mark) => mark.type === markType);
    return m ? (m.attrs["href"] as string) : null;
  }
  let found: string | null = null;
  state.doc.nodesBetween(from, to, (node) => {
    if (found) return false;
    const m = node.marks.find((mark) => mark.type === markType);
    if (m) found = m.attrs["href"] as string;
  });
  return found;
}

export function applyLink(markType: MarkType, href: string): Command {
  return (state, dispatch) => {
    const { from, to } = state.selection;
    if (from === to) return false;
    if (dispatch) {
      const tr = state.tr;
      tr.removeMark(from, to, markType);
      tr.addMark(from, to, markType.create({ href }));
      dispatch(tr);
    }
    return true;
  };
}

export function removeLink(markType: MarkType): Command {
  return (state, dispatch) => {
    const { from, to } = state.selection;
    if (dispatch) {
      dispatch(state.tr.removeMark(from, to, markType));
    }
    return true;
  };
}

function LinkToolbarItem() {
  const { schema } = useEditor();
  const editorState = useEditorState();
  const linkType = schema.marks["link"];
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const active = linkType ? isMarkActive(editorState, linkType) : false;
  const activeHref = linkType ? getActiveHref(editorState, linkType) : null;
  const canEdit = editorState
    ? active || !editorState.selection.empty
    : false;

  useEffect(() => {
    if (open) {
      setValue(activeHref ?? "");
      requestAnimationFrame(() => inputRef.current?.select());
    }
  }, [open, activeHref]);

  const apply = useEditorEventCallback((view, href: string) => {
    if (!view || !linkType) return;
    if (!href) return;
    applyLink(linkType, href)(view.state, view.dispatch);
    view.focus();
  });

  const remove = useEditorEventCallback((view) => {
    if (!view || !linkType) return;
    removeLink(linkType)(view.state, view.dispatch);
    view.focus();
  });

  if (!linkType) return null;

  return (
    <RadixPopover.Root open={open} onOpenChange={setOpen}>
      <RadixPopover.Trigger asChild>
        <MenuItem
          active={active}
          disabled={!canEdit}
          tooltip="Link"
          shortcut="⌘K"
        >
          <LinkSimple size={18} weight="bold" />
        </MenuItem>
      </RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          className="pp-popover"
          side="bottom"
          align="start"
          sideOffset={6}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <form
            className="pp-link-form"
            onSubmit={(e) => {
              e.preventDefault();
              apply(value.trim());
              setOpen(false);
            }}
          >
            <input
              ref={inputRef}
              type="url"
              className="pp-popover-input"
              placeholder="https://example.com"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
            />
            <button type="submit" className="pp-popover-btn pp-popover-btn-primary">
              {active ? "Update" : "Apply"}
            </button>
            {active && (
              <button
                type="button"
                className="pp-popover-btn"
                onClick={() => {
                  remove();
                  setOpen(false);
                }}
              >
                Remove
              </button>
            )}
          </form>
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}

function commandToggleLink(linkType: MarkType): Command {
  return (state, dispatch) => {
    const marks = state.storedMarks ?? state.selection.$from.marks();
    if (linkType.isInSet(marks)) {
      return toggleMark(linkType)(state, dispatch);
    }
    return state.selection.empty ? false : true;
  };
}

const URL_PATTERN = /^https?:\/\/\S+$/i;

function linkOnPastePlugin(markType: MarkType): Plugin {
  return new Plugin({
    props: {
      handlePaste(view, event) {
        const { selection } = view.state;
        if (selection.empty) return false;
        const text = event.clipboardData?.getData("text/plain");
        if (!text) return false;
        const url = text.trim();
        if (!URL_PATTERN.test(url)) return false;
        const { from, to } = selection;
        const tr = view.state.tr;
        tr.removeMark(from, to, markType);
        tr.addMark(from, to, markType.create({ href: url }));
        view.dispatch(tr);
        return true;
      },
    },
  });
}

export interface LinkOptions {
  /** Wrap the current selection with a link when a URL is pasted on top of it. Default: true. */
  linkOnPaste?: boolean;
}

export function createLink(options: LinkOptions = {}) {
  const { linkOnPaste = true } = options;
  return Extension.create({
    name: "link",
    marks: { link: linkSpec! },
    commands: {
      link: (schema) => commandToggleLink(schema.marks["link"]!),
    },
    keymap: { "Mod-k": "link", "Mod-K": "link" },
    isActive: (state, schema) => isMarkActive(state, schema.marks["link"]!),
    plugins: linkOnPaste
      ? (schema) => [linkOnPastePlugin(schema.marks["link"]!)]
      : undefined,
    toolbar: LinkToolbarItem,
    meta: { label: "Link", shortcut: "⌘K", group: "format", Icon: LinkSimple },
  });
}

export const Link = Object.assign(createLink(), {
  configure: (options: LinkOptions) => createLink(options),
});
