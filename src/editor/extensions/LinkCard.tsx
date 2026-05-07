import { ArrowSquareOut } from "@phosphor-icons/react";
import {
  useEditorEventCallback,
  useEditorState,
} from "@handlewithcare/react-prosemirror";
import * as RadixPopover from "@radix-ui/react-popover";
import type { Node, NodeSpec, NodeType } from "prosemirror-model";
import {
  NodeSelection,
  Plugin,
  PluginKey,
  type Command,
  type EditorState,
} from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { useState } from "react";

import { useEditor } from "../Editor";
import { MenuItem } from "../menu/MenuItem";
import { Extension } from "../types";

export interface LinkCardMetadata {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

export interface LinkCardOptions {
  /**
   * Optional async function called when a link card is inserted without
   * resolved metadata. Receives the URL, returns Open Graph–style fields.
   * If not provided, pasted URLs render as bare-URL cards and stay that
   * way. Hosts typically wire this to their own /api/unfurl endpoint
   * (which proxies to og:image scrapers like microlink, linkpreview,
   * etc.) — bundling a default would either break in CORS or pin a
   * third-party.
   */
  fetchMetadata?: (url: string) => Promise<LinkCardMetadata>;
}

const URL_REGEX = /^https?:\/\/\S+$/;

const linkCardSpec: NodeSpec = {
  attrs: {
    url: { default: "" },
    title: { default: "" },
    description: { default: "" },
    image: { default: "" },
    siteName: { default: "" },
    loaded: { default: false },
  },
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  parseDOM: [
    {
      tag: "a[data-link-card]",
      priority: 1000,
      getAttrs(dom) {
        if (!(dom instanceof HTMLElement)) return false;
        return {
          url: dom.getAttribute("href") ?? "",
          title:
            dom.querySelector(".pp-link-card-title")?.textContent ??
            dom.getAttribute("data-title") ??
            "",
          description:
            dom.querySelector(".pp-link-card-description")?.textContent ?? "",
          image:
            dom.querySelector<HTMLImageElement>(".pp-link-card-image")?.src ?? "",
          siteName:
            dom.querySelector(".pp-link-card-site")?.textContent ?? "",
          loaded: true,
        };
      },
    },
  ],
  toDOM(node) {
    const url = (node.attrs["url"] as string) || "";
    const title = (node.attrs["title"] as string) || "";
    const description = (node.attrs["description"] as string) || "";
    const image = (node.attrs["image"] as string) || "";
    const siteName = (node.attrs["siteName"] as string) || "";

    const body: (string | (string | object | (string | object)[])[])[] = [
      ["div", { class: "pp-link-card-title" }, title || url],
    ];
    if (description) {
      body.push(["div", { class: "pp-link-card-description" }, description]);
    }
    if (siteName) {
      body.push(["div", { class: "pp-link-card-site" }, siteName]);
    }

    const children: (string | object | (string | object)[])[] = [];
    if (image) {
      children.push([
        "img",
        { src: image, alt: "", class: "pp-link-card-image" },
      ]);
    }
    children.push(["div", { class: "pp-link-card-body" }, ...body]);

    return [
      "a",
      {
        class: "pp-link-card",
        href: url || "#",
        "data-link-card": "",
        target: "_blank",
        rel: "noopener noreferrer",
      },
      ...children,
    ];
  },
};

function isLinkCardSelected(state: EditorState | null, type: NodeType): boolean {
  if (!state) return false;
  const { selection } = state;
  return selection instanceof NodeSelection && selection.node.type === type;
}

function insertLinkCard(type: NodeType, attrs: Partial<Node["attrs"]>): Command {
  return (state, dispatch) => {
    if (!attrs["url"]) return false;
    if (dispatch) {
      dispatch(
        state.tr
          .replaceSelectionWith(type.create({ ...attrs, loaded: !!attrs["title"] }))
          .scrollIntoView(),
      );
    }
    return true;
  };
}

const linkCardPluginKey = new PluginKey("pp-link-card");

function findUnloadedCard(
  doc: Node,
  type: NodeType,
  url: string,
): { pos: number; node: Node } | null {
  let result: { pos: number; node: Node } | null = null;
  doc.descendants((n, p) => {
    if (result) return false;
    if (n.type === type && n.attrs["url"] === url && !n.attrs["loaded"]) {
      result = { pos: p, node: n };
      return false;
    }
    return undefined;
  });
  return result;
}

function findCardByUrl(
  doc: Node,
  type: NodeType,
  url: string,
): { pos: number; node: Node } | null {
  let result: { pos: number; node: Node } | null = null;
  doc.descendants((n, p) => {
    if (result) return false;
    if (n.type === type && n.attrs["url"] === url) {
      result = { pos: p, node: n };
      return false;
    }
    return undefined;
  });
  return result;
}

function buildLinkCardPlugin(
  type: NodeType,
  fetchMetadata?: (url: string) => Promise<LinkCardMetadata>,
) {
  const inFlight = new Set<string>();

  function maybeFetch(view: EditorView) {
    if (!fetchMetadata) return;
    view.state.doc.descendants((node, _pos) => {
      if (node.type !== type) return;
      if (node.attrs["loaded"]) return;
      const url = node.attrs["url"] as string;
      if (!url || inFlight.has(url)) return;
      inFlight.add(url);
      fetchMetadata(url)
        .then((meta) => {
          const found = findUnloadedCard(view.state.doc, type, url);
          if (!found) return;
          const tr = view.state.tr.setNodeMarkup(found.pos, undefined, {
            ...found.node.attrs,
            title: meta.title ?? "",
            description: meta.description ?? "",
            image: meta.image ?? "",
            siteName: meta.siteName ?? "",
            loaded: true,
          });
          view.dispatch(tr.setMeta("addToHistory", false));
        })
        .catch(() => {
          const found = findCardByUrl(view.state.doc, type, url);
          if (!found) return;
          const tr = view.state.tr.setNodeMarkup(found.pos, undefined, {
            ...found.node.attrs,
            loaded: true,
          });
          view.dispatch(tr.setMeta("addToHistory", false));
        })
        .finally(() => {
          inFlight.delete(url);
        });
      return false;
    });
  }

  return new Plugin({
    key: linkCardPluginKey,
    view(view) {
      maybeFetch(view);
      return {
        update(view) {
          maybeFetch(view);
        },
      };
    },
    props: {
      // Bare URL pasted into an empty block → link card. If the user is
      // pasting into existing text, fall through so the Link mark wins.
      handlePaste(view, event) {
        const text = event.clipboardData?.getData("text/plain")?.trim() ?? "";
        if (!text || !URL_REGEX.test(text)) return false;
        const { selection } = view.state;
        if (!selection.empty) return false;
        const parent = selection.$from.parent;
        if (!parent.isTextblock || parent.content.size > 0) return false;
        const tr = view.state.tr.replaceSelectionWith(
          type.create({ url: text, loaded: false }),
        );
        view.dispatch(tr.scrollIntoView());
        return true;
      },
      // Click selects the node instead of navigating; cmd/ctrl-click opens.
      handleClickOn(view, _pos, node, nodePos, event) {
        if (node.type !== type) return false;
        if (event.metaKey || event.ctrlKey) {
          // Native open-in-new-tab behavior — let the browser take it.
          return false;
        }
        event.preventDefault();
        view.dispatch(
          view.state.tr.setSelection(
            NodeSelection.create(view.state.doc, nodePos),
          ),
        );
        return true;
      },
      handleDoubleClickOn(view, _pos, node, _nodePos, event) {
        if (node.type !== type) return false;
        const url = node.attrs["url"] as string;
        if (!url) return false;
        event.preventDefault();
        if (typeof window !== "undefined") {
          window.open(url, "_blank", "noopener,noreferrer");
        }
        return true;
      },
    },
  });
}

interface LinkCardToolbarItemProps {
  fetchMetadata?: (url: string) => Promise<LinkCardMetadata>;
}

function LinkCardToolbarItem({ fetchMetadata: _fetchMetadata }: LinkCardToolbarItemProps) {
  const { schema } = useEditor();
  const editorState = useEditorState();
  const linkCardType = schema.nodes["link_card"];
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");

  const insert = useEditorEventCallback(
    (view, attrs: { url: string; title?: string }) => {
      if (!view || !linkCardType) return;
      insertLinkCard(linkCardType, attrs)(view.state, view.dispatch);
      view.focus();
    },
  );

  if (!linkCardType) return null;
  const active = isLinkCardSelected(editorState, linkCardType);

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
        <MenuItem active={active} tooltip="Insert link card">
          <ArrowSquareOut size={18} weight="bold" />
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
                url: trimmed,
                title: title.trim() || undefined,
              });
              setOpen(false);
              setUrl("");
              setTitle("");
            }}
          >
            <label className="pp-popover-label">URL</label>
            <input
              type="url"
              className="pp-popover-input"
              placeholder="https://example.com/article"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoFocus
            />
            <label className="pp-popover-label">Title (optional)</label>
            <input
              type="text"
              className="pp-popover-input"
              placeholder="Card title"
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

export function createLinkCard({ fetchMetadata }: LinkCardOptions = {}) {
  return Extension.create({
    name: "link-card",
    nodes: { link_card: linkCardSpec },
    isActive: (state, schema) =>
      isLinkCardSelected(state, schema.nodes["link_card"]!),
    plugins: (schema) => {
      const type = schema.nodes["link_card"];
      if (!type) return [];
      return [buildLinkCardPlugin(type, fetchMetadata)];
    },
    toolbar: () => <LinkCardToolbarItem fetchMetadata={fetchMetadata} />,
    meta: { label: "Link card", group: "block", Icon: ArrowSquareOut },
  });
}

export const LinkCard = createLinkCard();
