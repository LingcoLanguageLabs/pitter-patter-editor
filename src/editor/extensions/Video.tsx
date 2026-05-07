import { FilmStrip } from "@phosphor-icons/react";
import {
  useEditorEventCallback,
  useEditorState,
} from "@handlewithcare/react-prosemirror";
import * as RadixPopover from "@radix-ui/react-popover";
import type { NodeSpec, NodeType } from "prosemirror-model";
import {
  NodeSelection,
  Plugin,
  type Command,
  type EditorState,
} from "prosemirror-state";
import { useState } from "react";

import { useEditor } from "../Editor";
import { MenuItem } from "../menu/MenuItem";
import { Extension } from "../types";

const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i;
const URL_PATTERN = /^https?:\/\/\S+$/i;

const videoSpec: NodeSpec = {
  attrs: {
    src: { default: "" },
    poster: { default: "" },
    title: { default: "" },
    width: { default: 640 },
    height: { default: 360 },
  },
  group: "block",
  selectable: true,
  draggable: true,
  atom: true,
  parseDOM: [
    {
      tag: "video[src]",
      getAttrs(dom) {
        if (!(dom instanceof HTMLElement)) return false;
        return {
          src: dom.getAttribute("src") ?? "",
          poster: dom.getAttribute("poster") ?? "",
          title: dom.getAttribute("title") ?? "",
          width: Number(dom.getAttribute("width") ?? 640),
          height: Number(dom.getAttribute("height") ?? 360),
        };
      },
    },
  ],
  toDOM(node) {
    const attrs: Record<string, string> = {
      controls: "true",
      preload: "metadata",
      class: "pp-video",
      src: (node.attrs["src"] as string) ?? "",
      width: String(node.attrs["width"] ?? 640),
      height: String(node.attrs["height"] ?? 360),
    };
    const poster = (node.attrs["poster"] as string) || "";
    const title = (node.attrs["title"] as string) || "";
    if (poster) attrs["poster"] = poster;
    if (title) attrs["title"] = title;
    return ["video", attrs];
  },
};

function isVideoSelected(state: EditorState | null, type: NodeType): boolean {
  if (!state) return false;
  const { selection } = state;
  return selection instanceof NodeSelection && selection.node.type === type;
}

function insertVideo(
  type: NodeType,
  attrs: { src: string; poster?: string; title?: string },
): Command {
  return (state, dispatch) => {
    if (!attrs.src) return false;
    if (dispatch) {
      dispatch(
        state.tr
          .replaceSelectionWith(
            type.create({
              src: attrs.src,
              poster: attrs.poster ?? "",
              title: attrs.title ?? "",
            }),
          )
          .scrollIntoView(),
      );
    }
    return true;
  };
}

function VideoToolbarItem() {
  const { schema } = useEditor();
  const editorState = useEditorState();
  const videoType = schema.nodes["video"];
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [poster, setPoster] = useState("");

  const insert = useEditorEventCallback(
    (view, attrs: { src: string; poster?: string }) => {
      if (!view || !videoType) return;
      insertVideo(videoType, attrs)(view.state, view.dispatch);
      view.focus();
    },
  );

  if (!videoType) return null;
  const active = isVideoSelected(editorState, videoType);

  return (
    <RadixPopover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setUrl("");
          setPoster("");
        }
      }}
    >
      <RadixPopover.Trigger asChild>
        <MenuItem active={active} tooltip="Insert video">
          <FilmStrip size={18} weight="bold" />
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
              const trimmed = url.trim();
              if (!trimmed) return;
              insert({
                src: trimmed,
                poster: poster.trim() || undefined,
              });
              setOpen(false);
              setUrl("");
              setPoster("");
            }}
          >
            <label className="pp-popover-label">Video URL</label>
            <input
              type="url"
              className="pp-popover-input"
              placeholder="https://example.com/clip.mp4"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoFocus
            />
            <label className="pp-popover-label">Poster image (optional)</label>
            <input
              type="url"
              className="pp-popover-input"
              placeholder="https://example.com/poster.jpg"
              value={poster}
              onChange={(e) => setPoster(e.target.value)}
            />
            <div className="pp-image-actions">
              <button type="submit" className="pp-popover-btn pp-popover-btn-primary">
                Insert
              </button>
            </div>
          </form>
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}

export const Video = Extension.create({
  name: "video",
  nodes: { video: videoSpec },
  isActive: (state, schema) => isVideoSelected(state, schema.nodes["video"]!),
  toolbar: VideoToolbarItem,
  // Bare video URL pasted into an empty paragraph → video node.
  plugins: (schema) => {
    const videoType = schema.nodes["video"];
    if (!videoType) return [];
    return [
      new Plugin({
        props: {
          handlePaste(view, event) {
            const text = event.clipboardData?.getData("text/plain")?.trim() ?? "";
            if (!text) return false;
            if (!URL_PATTERN.test(text)) return false;
            if (!VIDEO_EXT.test(text)) return false;
            const { selection } = view.state;
            if (!selection.empty) return false;
            const parent = selection.$from.parent;
            if (!parent.isTextblock || parent.content.size > 0) return false;
            view.dispatch(
              view.state.tr
                .replaceSelectionWith(videoType.create({ src: text }))
                .scrollIntoView(),
            );
            return true;
          },
        },
      }),
    ];
  },
  meta: { label: "Video", group: "block", Icon: FilmStrip },
});
