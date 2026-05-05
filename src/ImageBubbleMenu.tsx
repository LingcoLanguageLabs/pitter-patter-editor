import { Trash } from "@phosphor-icons/react";
import { useEditorEventCallback, useEditorState } from "@handlewithcare/react-prosemirror";
import { NodeSelection, type EditorState } from "prosemirror-state";
import { useEffect, useState } from "react";

import { useEditor } from "./editor";
import { MenuItem } from "./editor";
import {
  FloatingMenu,
  Toolbar as ToolbarPrimitive,
  ToolbarGroup,
  ToolbarSeparator,
  TooltipProvider,
} from "./editor/menu";

export function isImageNode(state: EditorState): boolean {
  return (
    state.selection instanceof NodeSelection &&
    state.selection.node.type.name === "image"
  );
}

function getActiveAlt(state: EditorState | null): string {
  if (!state) return "";
  if (!(state.selection instanceof NodeSelection)) return "";
  if (state.selection.node.type.name !== "image") return "";
  return (state.selection.node.attrs["alt"] as string | undefined) ?? "";
}

const shouldShow = (state: EditorState) => isImageNode(state);

function ImageMenuContents() {
  const editorState = useEditorState();
  const activeAlt = getActiveAlt(editorState);
  const [draft, setDraft] = useState(activeAlt);

  useEffect(() => {
    setDraft(activeAlt);
  }, [activeAlt]);

  const updateAlt = useEditorEventCallback((view, alt: string) => {
    if (!view) return;
    const { selection } = view.state;
    if (!(selection instanceof NodeSelection)) return;
    if (selection.node.type.name !== "image") return;
    view.dispatch(
      view.state.tr.setNodeMarkup(selection.from, undefined, {
        ...selection.node.attrs,
        alt,
      }),
    );
  });

  const remove = useEditorEventCallback((view) => {
    if (!view) return;
    const { selection } = view.state;
    if (!(selection instanceof NodeSelection)) return;
    if (selection.node.type.name !== "image") return;
    view.dispatch(view.state.tr.deleteSelection());
  });

  return (
    <ToolbarPrimitive variant="floating">
      <ToolbarGroup>
        <input
          type="text"
          placeholder="Alt text"
          className="pp-image-alt-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => updateAlt(draft)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              updateAlt(draft);
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
      </ToolbarGroup>
      <ToolbarSeparator />
      <ToolbarGroup>
        <MenuItem onClick={() => remove()} tooltip="Delete image">
          <Trash size={16} weight="bold" />
        </MenuItem>
      </ToolbarGroup>
    </ToolbarPrimitive>
  );
}

export function ImageBubbleMenu() {
  const { schema } = useEditor();
  if (!schema.nodes["image"]) return null;
  return (
    <TooltipProvider delayDuration={200} skipDelayDuration={300}>
      <FloatingMenu shouldShow={shouldShow} placement="bottom" offset={6}>
        <ImageMenuContents />
      </FloatingMenu>
    </TooltipProvider>
  );
}
