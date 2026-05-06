import { YoutubeLogo } from "@phosphor-icons/react";
import {
  useEditorEventCallback,
  useEditorState,
} from "@handlewithcare/react-prosemirror";
import * as RadixPopover from "@radix-ui/react-popover";
import type { NodeSpec, NodeType } from "prosemirror-model";
import type { Command, EditorState } from "prosemirror-state";
import { NodeSelection, Plugin } from "prosemirror-state";
import { useState } from "react";

import { useEditor } from "../Editor";
import { MenuItem } from "../menu/MenuItem";
import { Extension } from "../types";

const YOUTUBE_URL_REGEX =
  /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

interface ParsedYouTube {
  id: string;
  start: number;
}

function parseYouTubeURL(url: string): ParsedYouTube | null {
  const match = url.match(YOUTUBE_URL_REGEX);
  if (!match || !match[1]) return null;
  const id = match[1];
  let start = 0;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    const t = u.searchParams.get("t") ?? u.searchParams.get("start");
    if (t) {
      const tm = /(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?/.exec(t);
      if (tm) {
        const h = parseInt(tm[1] ?? "0", 10);
        const m = parseInt(tm[2] ?? "0", 10);
        const s = parseInt(tm[3] ?? "0", 10);
        start = h * 3600 + m * 60 + s;
      }
    }
  } catch {
    /* ignore — bare hosts work too */
  }
  return { id, start };
}

function buildEmbedURL(id: string, start: number, privacyMode: boolean): string {
  const params = new URLSearchParams();
  if (start > 0) params.set("start", String(start));
  const qs = params.toString();
  const host = privacyMode ? "www.youtube-nocookie.com" : "www.youtube.com";
  return `https://${host}/embed/${id}${qs ? `?${qs}` : ""}`;
}

const youtubeSpec: NodeSpec = {
  attrs: {
    src: { default: "" },
    width: { default: 640 },
    height: { default: 360 },
  },
  group: "block",
  selectable: true,
  draggable: true,
  atom: true,
  parseDOM: [
    {
      tag: "div[data-youtube-video]",
      getAttrs(dom) {
        if (!(dom instanceof HTMLElement)) return false;
        const iframe = dom.querySelector("iframe");
        if (!iframe) return false;
        return {
          src: iframe.getAttribute("src") || "",
          width: Number(iframe.getAttribute("width") || 640),
          height: Number(iframe.getAttribute("height") || 360),
        };
      },
    },
  ],
  toDOM(node) {
    return [
      "div",
      { "data-youtube-video": "" },
      [
        "iframe",
        {
          src: node.attrs["src"],
          width: String(node.attrs["width"]),
          height: String(node.attrs["height"]),
          frameborder: "0",
          allowfullscreen: "true",
          allow:
            "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
        },
      ],
    ];
  },
};

function insertYouTube(youtubeType: NodeType, src: string): Command {
  return (state, dispatch) => {
    if (dispatch) {
      dispatch(
        state.tr.replaceSelectionWith(youtubeType.create({ src })).scrollIntoView(),
      );
    }
    return true;
  };
}

function isYouTubeSelected(state: EditorState | null, youtubeType: NodeType): boolean {
  if (!state) return false;
  const { selection } = state;
  if (!(selection instanceof NodeSelection)) return false;
  return selection.node.type === youtubeType;
}

interface YouTubeToolbarItemProps {
  privacyMode: boolean;
}

function YouTubeToolbarItem({ privacyMode }: YouTubeToolbarItemProps) {
  const { schema } = useEditor();
  const editorState = useEditorState();
  const youtubeType = schema.nodes["youtube"];
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const insert = useEditorEventCallback((view, src: string) => {
    if (!view || !youtubeType) return;
    insertYouTube(youtubeType, src)(view.state, view.dispatch);
    view.focus();
  });

  if (!youtubeType) return null;
  const active = isYouTubeSelected(editorState, youtubeType);

  return (
    <RadixPopover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setUrl("");
          setError(null);
        }
      }}
    >
      <RadixPopover.Trigger asChild>
        <MenuItem active={active} tooltip="Insert YouTube video">
          <YoutubeLogo size={18} weight="bold" />
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
              const parsed = parseYouTubeURL(trimmed);
              if (!parsed) {
                setError("Not a valid YouTube URL");
                return;
              }
              const src = buildEmbedURL(parsed.id, parsed.start, privacyMode);
              insert(src);
              setOpen(false);
              setUrl("");
              setError(null);
            }}
          >
            <label className="pp-popover-label">YouTube URL</label>
            <input
              type="url"
              className="pp-popover-input"
              placeholder="https://www.youtube.com/watch?v=…"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (error) setError(null);
              }}
              autoFocus
            />
            {error && <div className="pp-popover-error">{error}</div>}
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

export interface YouTubeOptions {
  /**
   * When true (default), embeds use `youtube-nocookie.com` — Google's
   * privacy-enhanced player that doesn't drop tracking cookies until the
   * viewer hits play. Set to false for the standard `youtube.com/embed/`
   * URL if your site already handles consent or you want the friendlier
   * domain in the rendered HTML.
   */
  privacyMode?: boolean;
}

export function createYouTube({ privacyMode = true }: YouTubeOptions = {}) {
  return Extension.create({
    name: "youtube",
    nodes: { youtube: youtubeSpec },
    isActive: (state, schema) =>
      isYouTubeSelected(state, schema.nodes["youtube"]!),
    toolbar: () => <YouTubeToolbarItem privacyMode={privacyMode} />,
    // Auto-embed when a bare YouTube URL is pasted. Only triggers when the
    // pasted text is exclusively the URL — pasting "watch this <url>" keeps
    // the URL as text since the regex anchors at the start of the string.
    plugins: (schema) => {
      const youtubeType = schema.nodes["youtube"];
      if (!youtubeType) return [];
      return [
        new Plugin({
          props: {
            handlePaste(view, event) {
              const text =
                event.clipboardData?.getData("text/plain")?.trim() ?? "";
              if (!text) return false;
              const parsed = parseYouTubeURL(text);
              if (!parsed) return false;
              const src = buildEmbedURL(parsed.id, parsed.start, privacyMode);
              const tr = view.state.tr.replaceSelectionWith(
                youtubeType.create({ src }),
              );
              view.dispatch(tr.scrollIntoView());
              return true;
            },
          },
        }),
      ];
    },
    meta: { label: "YouTube", group: "block", Icon: YoutubeLogo },
  });
}

export const YouTube = createYouTube();
