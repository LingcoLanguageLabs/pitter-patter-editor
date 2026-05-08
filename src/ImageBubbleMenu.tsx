import {
  AlignCenterHorizontalSimple,
  AlignLeft,
  AlignRight,
  MagicWand,
  Trash,
} from "@phosphor-icons/react";
import {
  useEditorEventCallback,
  useEditorState,
} from "@handlewithcare/react-prosemirror";
import { NodeSelection, type EditorState } from "prosemirror-state";
import { useEffect, useState } from "react";

import { useEditor } from "./editor";
import { MenuItem } from "./editor";
import { setImageAlign, setImageWidth, type ImageAlign } from "./editor/extensions/Image";
import {
  FloatingMenu,
  Toolbar as ToolbarPrimitive,
  ToolbarGroup,
  ToolbarSeparator,
  TooltipProvider,
} from "./editor/menu";

const AI_ALT_ENDPOINT = "http://localhost:3001/api/ai/alt";

export function isImageNode(state: EditorState): boolean {
  return (
    state.selection instanceof NodeSelection &&
    state.selection.node.type.name === "image"
  );
}

interface ImageState {
  alt: string;
  align: ImageAlign;
  widthPercent: number;
}

const DEFAULT_WIDTH = 100;

function readImageState(state: EditorState | null): ImageState {
  const fallback: ImageState = {
    alt: "",
    align: "center",
    widthPercent: DEFAULT_WIDTH,
  };
  if (!state) return fallback;
  if (!(state.selection instanceof NodeSelection)) return fallback;
  if (state.selection.node.type.name !== "image") return fallback;
  const attrs = state.selection.node.attrs as {
    alt?: string | null;
    align?: ImageAlign;
    width?: string | null;
  };
  return {
    alt: attrs.alt ?? "",
    align: attrs.align ?? "center",
    widthPercent: parseWidthPercent(attrs.width ?? null),
  };
}

function parseWidthPercent(width: string | null): number {
  if (!width) return DEFAULT_WIDTH;
  const match = width.trim().match(/^(\d+)%$/);
  if (!match) return DEFAULT_WIDTH;
  const value = Number.parseInt(match[1]!, 10);
  return Number.isFinite(value) ? value : DEFAULT_WIDTH;
}

const shouldShow = (state: EditorState) => isImageNode(state);

function ImageMenuContents() {
  const editorState = useEditorState();
  const current = readImageState(editorState);
  const [draftAlt, setDraftAlt] = useState(current.alt);
  const [draftWidth, setDraftWidth] = useState(current.widthPercent);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    setDraftAlt(current.alt);
    setDraftWidth(current.widthPercent);
    // Re-sync when selection changes to a different image — keyed on the
    // values themselves rather than identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.alt, current.widthPercent]);

  const updateAlt = useEditorEventCallback((view, alt: string) => {
    if (!view) return;
    const { selection } = view.state;
    if (!(selection instanceof NodeSelection)) return;
    if (selection.node.type.name !== "image") return;
    view.dispatch(
      view.state.tr.setNodeMarkup(selection.from, undefined, {
        ...selection.node.attrs,
        alt: alt || null,
      }),
    );
  });

  const align = useEditorEventCallback((view, value: ImageAlign) => {
    if (!view) return;
    setImageAlign(value)(view.state, view.dispatch);
  });

  const width = useEditorEventCallback((view, value: number) => {
    if (!view) return;
    setImageWidth(value)(view.state, view.dispatch);
  });

  const remove = useEditorEventCallback((view) => {
    if (!view) return;
    const { selection } = view.state;
    if (!(selection instanceof NodeSelection)) return;
    if (selection.node.type.name !== "image") return;
    view.dispatch(view.state.tr.deleteSelection());
  });

  const generateAlt = useEditorEventCallback(async (view) => {
    if (!view) return;
    const { selection } = view.state;
    if (!(selection instanceof NodeSelection)) return;
    if (selection.node.type.name !== "image") return;
    const src = selection.node.attrs["src"] as string | undefined;
    if (!src) return;
    setGenerating(true);
    setDraftAlt("");
    try {
      const response = await fetch(AI_ALT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ src }),
      });
      if (!response.ok || !response.body) return;
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffered = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        buffered += value;
        setDraftAlt(buffered);
      }
      // Persist final alt onto the node.
      const finalAlt = buffered.trim();
      if (finalAlt) {
        const sel = view.state.selection;
        if (sel instanceof NodeSelection && sel.node.type.name === "image") {
          view.dispatch(
            view.state.tr.setNodeMarkup(sel.from, undefined, {
              ...sel.node.attrs,
              alt: finalAlt,
            }),
          );
        }
      }
    } finally {
      setGenerating(false);
    }
  });

  return (
    <ToolbarPrimitive variant="floating">
      <ToolbarGroup>
        <input
          type="text"
          placeholder="Alt text"
          className="pp-image-alt-input"
          value={draftAlt}
          onChange={(e) => setDraftAlt(e.target.value)}
          onBlur={() => updateAlt(draftAlt)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              updateAlt(draftAlt);
              (e.target as HTMLInputElement).blur();
            }
          }}
          disabled={generating}
        />
        <MenuItem
          onClick={() => generateAlt()}
          tooltip="Generate alt text with AI"
          disabled={generating}
          active={generating}
        >
          <MagicWand size={14} weight="bold" />
        </MenuItem>
      </ToolbarGroup>
      <ToolbarSeparator />
      <ToolbarGroup>
        <MenuItem
          active={current.align === "left"}
          onClick={() => align("left")}
          tooltip="Align left"
        >
          <AlignLeft size={16} weight="bold" />
        </MenuItem>
        <MenuItem
          active={current.align === "center"}
          onClick={() => align("center")}
          tooltip="Align center"
        >
          <AlignCenterHorizontalSimple size={16} weight="bold" />
        </MenuItem>
        <MenuItem
          active={current.align === "right"}
          onClick={() => align("right")}
          tooltip="Align right"
        >
          <AlignRight size={16} weight="bold" />
        </MenuItem>
      </ToolbarGroup>
      <ToolbarSeparator />
      <ToolbarGroup>
        <div className="pp-image-width">
          <input
            type="range"
            min={25}
            max={100}
            step={5}
            value={draftWidth}
            onChange={(e) => {
              const next = Number.parseInt(e.target.value, 10);
              setDraftWidth(next);
              width(next);
            }}
            aria-label="Image width"
            className="pp-image-width-slider"
          />
          <span className="pp-image-width-value">{draftWidth}%</span>
        </div>
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
