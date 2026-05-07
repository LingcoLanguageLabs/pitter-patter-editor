import { MusicNote } from "@phosphor-icons/react";
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

const AUDIO_EXT = /\.(mp3|wav|ogg|m4a|aac|flac|opus)(\?|#|$)/i;
const URL_PATTERN = /^https?:\/\/\S+$/i;

const audioSpec: NodeSpec = {
  attrs: {
    src: { default: "" },
    title: { default: "" },
  },
  group: "block",
  selectable: true,
  draggable: true,
  atom: true,
  parseDOM: [
    {
      tag: "audio[src]",
      getAttrs(dom) {
        if (!(dom instanceof HTMLElement)) return false;
        return {
          src: dom.getAttribute("src") ?? "",
          title: dom.getAttribute("title") ?? "",
        };
      },
    },
  ],
  toDOM(node) {
    const attrs: Record<string, string> = {
      controls: "true",
      preload: "metadata",
      class: "pp-audio",
      src: (node.attrs["src"] as string) ?? "",
    };
    const title = (node.attrs["title"] as string) || "";
    if (title) attrs["title"] = title;
    return ["audio", attrs];
  },
};

function isAudioSelected(state: EditorState | null, type: NodeType): boolean {
  if (!state) return false;
  const { selection } = state;
  return selection instanceof NodeSelection && selection.node.type === type;
}

function insertAudio(type: NodeType, attrs: { src: string; title?: string }): Command {
  return (state, dispatch) => {
    if (!attrs.src) return false;
    if (dispatch) {
      dispatch(
        state.tr
          .replaceSelectionWith(type.create({ src: attrs.src, title: attrs.title ?? "" }))
          .scrollIntoView(),
      );
    }
    return true;
  };
}

function AudioToolbarItem() {
  const { schema } = useEditor();
  const editorState = useEditorState();
  const audioType = schema.nodes["audio"];
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");

  const insert = useEditorEventCallback(
    (view, attrs: { src: string; title?: string }) => {
      if (!view || !audioType) return;
      insertAudio(audioType, attrs)(view.state, view.dispatch);
      view.focus();
    },
  );

  if (!audioType) return null;
  const active = isAudioSelected(editorState, audioType);

  return (
    <RadixPopover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setUrl("");
          setTitle("");
        }
      }}
    >
      <RadixPopover.Trigger asChild>
        <MenuItem active={active} tooltip="Insert audio">
          <MusicNote size={18} weight="bold" />
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
              insert({ src: trimmed, title: title.trim() || undefined });
              setOpen(false);
              setUrl("");
              setTitle("");
            }}
          >
            <label className="pp-popover-label">Audio URL</label>
            <input
              type="url"
              className="pp-popover-input"
              placeholder="https://example.com/track.mp3"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoFocus
            />
            <label className="pp-popover-label">Title (optional)</label>
            <input
              type="text"
              className="pp-popover-input"
              placeholder="Description for screen readers"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
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

export const Audio = Extension.create({
  name: "audio",
  nodes: { audio: audioSpec },
  isActive: (state, schema) => isAudioSelected(state, schema.nodes["audio"]!),
  toolbar: AudioToolbarItem,
  // Bare audio URL pasted into an empty paragraph → audio node.
  plugins: (schema) => {
    const audioType = schema.nodes["audio"];
    if (!audioType) return [];
    return [
      new Plugin({
        props: {
          handlePaste(view, event) {
            const text = event.clipboardData?.getData("text/plain")?.trim() ?? "";
            if (!text) return false;
            if (!URL_PATTERN.test(text)) return false;
            if (!AUDIO_EXT.test(text)) return false;
            const { selection } = view.state;
            if (!selection.empty) return false;
            const parent = selection.$from.parent;
            if (!parent.isTextblock || parent.content.size > 0) return false;
            view.dispatch(
              view.state.tr
                .replaceSelectionWith(audioType.create({ src: text }))
                .scrollIntoView(),
            );
            return true;
          },
        },
      }),
    ];
  },
  meta: { label: "Audio", group: "block", Icon: MusicNote },
});
