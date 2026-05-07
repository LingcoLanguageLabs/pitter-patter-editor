import { Anchor as AnchorIcon } from "@phosphor-icons/react";
import { useEditorEventCallback, useEditorState } from "@handlewithcare/react-prosemirror";
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

const anchorSpec: NodeSpec = {
  inline: true,
  group: "inline",
  atom: true,
  selectable: true,
  draggable: false,
  attrs: { id: { default: "" } },
  parseDOM: [
    {
      tag: "a[data-anchor]",
      getAttrs(dom) {
        if (!(dom instanceof HTMLElement)) return false;
        return {
          id:
            dom.getAttribute("id") ??
            dom.getAttribute("data-anchor") ??
            "",
        };
      },
    },
  ],
  toDOM(node) {
    const id = (node.attrs["id"] as string) || "";
    const attrs: Record<string, string> = {
      "data-anchor": "",
      class: "pp-anchor",
      "aria-label": id ? `Anchor: ${id}` : "Anchor",
    };
    if (id) attrs["id"] = id;
    return ["a", attrs];
  },
};

function isAnchorSelected(state: EditorState | null, type: NodeType): boolean {
  if (!state) return false;
  const { selection } = state;
  return selection instanceof NodeSelection && selection.node.type === type;
}

function insertAnchor(type: NodeType, id: string): Command {
  return (state, dispatch) => {
    if (!id) return false;
    if (dispatch) {
      dispatch(
        state.tr
          .replaceSelectionWith(type.create({ id }), false)
          .scrollIntoView(),
      );
    }
    return true;
  };
}

function AnchorToolbarItem() {
  const { schema } = useEditor();
  const editorState = useEditorState();
  const anchorType = schema.nodes["anchor"];
  const [open, setOpen] = useState(false);
  const [id, setId] = useState("");

  const insert = useEditorEventCallback((view, value: string) => {
    if (!view || !anchorType) return;
    insertAnchor(anchorType, value)(view.state, view.dispatch);
    view.focus();
  });

  if (!anchorType) return null;
  const active = isAnchorSelected(editorState, anchorType);

  return (
    <RadixPopover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setId("");
      }}
    >
      <RadixPopover.Trigger asChild>
        <MenuItem active={active} tooltip="Insert anchor">
          <AnchorIcon size={18} weight="bold" />
        </MenuItem>
      </RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          className="pp-popover pp-image-popover"
          side="bottom"
          align="start"
          sideOffset={6}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <form
            className="pp-image-form"
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = id.trim().replace(/\s+/g, "-");
              if (!trimmed) return;
              insert(trimmed);
              setOpen(false);
              setId("");
            }}
          >
            <label className="pp-popover-label">Anchor ID</label>
            <input
              type="text"
              className="pp-popover-input"
              placeholder="my-section"
              value={id}
              onChange={(e) => setId(e.target.value)}
              autoFocus
            />
            <div className="pp-image-actions">
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

export const Anchor = Extension.create({
  name: "anchor",
  nodes: { anchor: anchorSpec },
  isActive: (state, schema) => isAnchorSelected(state, schema.nodes["anchor"]!),
  toolbar: AnchorToolbarItem,
  meta: { label: "Anchor", group: "block", Icon: AnchorIcon },
});
