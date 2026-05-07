import { Image as ImageIcon, UploadSimple } from "@phosphor-icons/react";
import {
  useEditorEventCallback,
  useEditorState,
} from "@handlewithcare/react-prosemirror";
import * as RadixPopover from "@radix-ui/react-popover";
import { InputRule } from "prosemirror-inputrules";
import type { Node as PmNode, NodeSpec, NodeType } from "prosemirror-model";
import { NodeSelection, Plugin, type Command, type EditorState } from "prosemirror-state";
import type { EditorView, NodeView } from "prosemirror-view";
import { useRef, useState } from "react";

import { useEditor } from "../Editor";
import { MenuItem } from "../menu/MenuItem";
import { Extension } from "../types";

export type ImageAlign = "left" | "center" | "right";

const VALID_ALIGNS: ReadonlySet<ImageAlign> = new Set(["left", "center", "right"]);
const MIN_WIDTH_PERCENT = 15;
const MAX_WIDTH_PERCENT = 100;

const imageSpec: NodeSpec = {
  group: "block",
  inline: false,
  atom: true,
  draggable: true,
  selectable: true,
  attrs: {
    src: { default: "" },
    alt: { default: null },
    title: { default: null },
    /** Width as CSS length (e.g. `"75%"`, `"320px"`) — null means natural. */
    width: { default: null },
    /** One of "left" | "center" | "right". */
    align: { default: "center" },
  },
  parseDOM: [
    {
      tag: "figure.pp-image",
      getAttrs(dom) {
        if (!(dom instanceof HTMLElement)) return false;
        const img = dom.querySelector("img");
        if (!img) return false;
        const align = dom.getAttribute("data-align") ?? "center";
        return {
          src: img.getAttribute("src") ?? "",
          alt: img.getAttribute("alt") || null,
          title: img.getAttribute("title") || null,
          width: dom.style.width || null,
          align: VALID_ALIGNS.has(align as ImageAlign) ? align : "center",
        };
      },
    },
    {
      tag: "img[src]",
      getAttrs(dom) {
        if (!(dom instanceof HTMLElement)) return false;
        return {
          src: dom.getAttribute("src") ?? "",
          alt: dom.getAttribute("alt") || null,
          title: dom.getAttribute("title") || null,
          width:
            dom.getAttribute("width") ||
            dom.style.width ||
            null,
          align: "center",
        };
      },
    },
  ],
  toDOM(node) {
    const { src, alt, title, width, align } = node.attrs as {
      src: string;
      alt: string | null;
      title: string | null;
      width: string | null;
      align: ImageAlign;
    };
    const figureAttrs: Record<string, string> = {
      class: "pp-image",
      "data-align": align,
    };
    if (width) figureAttrs["style"] = `width: ${width}`;
    const imgAttrs: Record<string, string> = { src };
    if (alt) imgAttrs["alt"] = alt;
    if (title) imgAttrs["title"] = title;
    return ["figure", figureAttrs, ["img", imgAttrs]];
  },
};

function isImageSelected(state: EditorState | null, type: NodeType): boolean {
  if (!state) return false;
  const { selection } = state;
  return selection instanceof NodeSelection && selection.node.type === type;
}

function insertImage(
  imageType: NodeType,
  attrs: { src: string; alt?: string; title?: string },
): Command {
  return (state, dispatch) => {
    if (!attrs.src) return false;
    if (dispatch) {
      dispatch(
        state.tr
          .replaceSelectionWith(imageType.create(attrs))
          .scrollIntoView(),
      );
    }
    return true;
  };
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// ────────────────────────────────────────────────── NodeView

class ImageNodeView implements NodeView {
  dom: HTMLElement;
  private figure: HTMLElement;
  private img: HTMLImageElement;
  private node: PmNode;
  private view: EditorView;
  private getPos: () => number | undefined;
  private leftHandle: HTMLDivElement | null = null;
  private rightHandle: HTMLDivElement | null = null;
  private resizing = false;

  constructor(node: PmNode, view: EditorView, getPos: () => number | undefined) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;

    this.figure = document.createElement("figure");
    this.figure.className = "pp-image";
    this.img = document.createElement("img");
    this.img.draggable = false;
    this.figure.appendChild(this.img);
    this.dom = this.figure;

    this.applyAttrs(node);

    this.img.addEventListener("click", this.handleImgClick);
    // Stop wheel events from scrolling the page when the image is selected
    // and the user is dragging a handle — wheel during drag would disorient.
  }

  private handleImgClick = (event: MouseEvent) => {
    event.preventDefault();
    const pos = this.getPos();
    if (typeof pos !== "number") return;
    this.view.dispatch(
      this.view.state.tr.setSelection(
        NodeSelection.create(this.view.state.doc, pos),
      ),
    );
    this.view.focus();
  };

  private applyAttrs(node: PmNode) {
    const { src, alt, title, width, align } = node.attrs as {
      src: string;
      alt: string | null;
      title: string | null;
      width: string | null;
      align: ImageAlign;
    };
    if (this.img.src !== src) this.img.src = src;
    if (alt) this.img.alt = alt; else this.img.removeAttribute("alt");
    if (title) this.img.title = title; else this.img.removeAttribute("title");
    this.figure.dataset["align"] = align ?? "center";
    if (width) {
      this.figure.style.width = width;
    } else {
      this.figure.style.removeProperty("width");
    }
  }

  update(node: PmNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    if (!this.resizing) {
      this.applyAttrs(node);
    }
    return true;
  }

  selectNode() {
    this.figure.classList.add("ProseMirror-selectednode");
    this.addHandles();
  }

  deselectNode() {
    this.figure.classList.remove("ProseMirror-selectednode");
    this.removeHandles();
  }

  destroy() {
    this.img.removeEventListener("click", this.handleImgClick);
    this.removeHandles();
  }

  // Shield the NodeView from PM trying to handle pointer events on the
  // resize handles — those need to be ours.
  stopEvent(event: Event): boolean {
    return event instanceof PointerEvent &&
      event.target instanceof HTMLElement &&
      event.target.classList.contains("pp-image-handle");
  }

  ignoreMutation(mutation: MutationRecord | { type: "selection"; target: Node }): boolean {
    // Class/attr changes on the figure are ours; PM shouldn't redraw on them.
    if (
      "type" in mutation &&
      mutation.type !== "selection" &&
      (mutation as MutationRecord).target === this.figure
    ) {
      return true;
    }
    return false;
  }

  // ───── Resize handles

  private addHandles() {
    if (this.leftHandle || this.rightHandle) return;
    this.leftHandle = this.makeHandle("left");
    this.rightHandle = this.makeHandle("right");
    this.figure.appendChild(this.leftHandle);
    this.figure.appendChild(this.rightHandle);
  }

  private removeHandles() {
    this.leftHandle?.remove();
    this.rightHandle?.remove();
    this.leftHandle = null;
    this.rightHandle = null;
  }

  private makeHandle(side: "left" | "right"): HTMLDivElement {
    const handle = document.createElement("div");
    handle.className = `pp-image-handle pp-image-handle-${side}`;
    handle.dataset["side"] = side;
    handle.addEventListener("mousedown", (e) => this.beginResize(e, side));
    return handle;
  }

  private beginResize(event: MouseEvent, side: "left" | "right") {
    event.preventDefault();
    event.stopPropagation();
    this.resizing = true;

    const parent = this.figure.parentElement;
    const parentWidth = parent?.clientWidth ?? this.figure.clientWidth;
    const startWidthPx = this.figure.clientWidth;
    const startX = event.clientX;
    const direction = side === "right" ? 1 : -1;

    const onMove = (moveEvent: MouseEvent) => {
      const delta = (moveEvent.clientX - startX) * direction;
      const nextWidthPx = clamp(
        startWidthPx + delta,
        (MIN_WIDTH_PERCENT / 100) * parentWidth,
        parentWidth,
      );
      const nextPercent = Math.round((nextWidthPx / parentWidth) * 100);
      const clamped = clamp(nextPercent, MIN_WIDTH_PERCENT, MAX_WIDTH_PERCENT);
      this.figure.style.width = `${clamped}%`;
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      const pos = this.getPos();
      if (typeof pos !== "number") {
        this.resizing = false;
        return;
      }
      // Read the committed width back from the live element and persist.
      const width = this.figure.style.width || null;
      this.view.dispatch(
        this.view.state.tr.setNodeMarkup(pos, undefined, {
          ...this.node.attrs,
          width,
        }),
      );
      this.resizing = false;
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ────────────────────────────────────────────────── Toolbar

function ImageToolbarItem() {
  const { schema } = useEditor();
  const editorState = useEditorState();
  const imageType = schema.nodes["image"];
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [alt, setAlt] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const insertFromUrl = useEditorEventCallback(
    (view, src: string, altText: string) => {
      if (!view || !imageType || !src) return;
      insertImage(imageType, { src, alt: altText || undefined })(
        view.state,
        view.dispatch,
      );
      view.focus();
    },
  );

  const insertFromFile = useEditorEventCallback(
    (view, dataUrl: string, altText: string) => {
      if (!view || !imageType) return;
      insertImage(imageType, { src: dataUrl, alt: altText || undefined })(
        view.state,
        view.dispatch,
      );
      view.focus();
    },
  );

  if (!imageType) return null;
  const active = isImageSelected(editorState, imageType);

  const handleFile = async (file: File) => {
    const dataUrl = await readFileAsDataURL(file);
    insertFromFile(dataUrl, alt);
    setOpen(false);
    setUrl("");
    setAlt("");
  };

  return (
    <RadixPopover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setUrl("");
          setAlt("");
        }
      }}
    >
      <RadixPopover.Trigger asChild>
        <MenuItem active={active} tooltip="Insert image" className="pp-add-button">
          <ImageIcon size={18} weight="bold" />
          <span className="pp-add-label">Add</span>
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
              insertFromUrl(trimmed, alt);
              setOpen(false);
              setUrl("");
              setAlt("");
            }}
          >
            <label className="pp-popover-label">URL</label>
            <input
              type="url"
              className="pp-popover-input"
              placeholder="https://example.com/image.jpg"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoFocus
            />
            <label className="pp-popover-label">Alt text (optional)</label>
            <input
              type="text"
              className="pp-popover-input"
              placeholder="Description"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
            />
            <div className="pp-image-actions">
              <button type="submit" className="pp-popover-btn pp-popover-btn-primary">
                Insert
              </button>
              <button
                type="button"
                className="pp-popover-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadSimple size={14} weight="bold" />
                Upload
              </button>
            </div>
          </form>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = "";
            }}
          />
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}

// ────────────────────────────────────────────────── Commands

/** Update the alignment of the currently-selected image. */
export function setImageAlign(align: ImageAlign): Command {
  return (state, dispatch) => {
    const { selection } = state;
    if (!(selection instanceof NodeSelection)) return false;
    if (selection.node.type.name !== "image") return false;
    if (dispatch) {
      dispatch(
        state.tr.setNodeMarkup(selection.from, undefined, {
          ...selection.node.attrs,
          align,
        }),
      );
    }
    return true;
  };
}

/** Update the width of the currently-selected image (percent string). */
export function setImageWidth(widthPercent: number): Command {
  return (state, dispatch) => {
    const { selection } = state;
    if (!(selection instanceof NodeSelection)) return false;
    if (selection.node.type.name !== "image") return false;
    const clamped = clamp(
      Math.round(widthPercent),
      MIN_WIDTH_PERCENT,
      MAX_WIDTH_PERCENT,
    );
    if (dispatch) {
      dispatch(
        state.tr.setNodeMarkup(selection.from, undefined, {
          ...selection.node.attrs,
          width: `${clamped}%`,
        }),
      );
    }
    return true;
  };
}

// Markdown image: ![alt](src "title")
const IMAGE_MD_RULE =
  /(?:^|\s)!\[(?<alt>[^\]]*)]\((?<src>\S+?)(?:\s+["'](?<title>[^"']+)["'])?\)\s$/;

function imageInputRule(imageType: NodeType): InputRule {
  return new InputRule(IMAGE_MD_RULE, (state, match, start, end) => {
    const groups = (match as RegExpMatchArray & { groups?: Record<string, string> })
      .groups;
    const src = groups?.["src"];
    if (!src) return null;
    const alt = groups?.["alt"] || null;
    const title = groups?.["title"] || null;
    const tr = state.tr.delete(start, end);
    return tr.insert(
      start,
      imageType.create({ src, alt, title }),
    );
  });
}

// ────────────────────────────────────────────────── Extension

export const Image = Extension.create({
  name: "image",
  nodes: { image: imageSpec },
  isActive: (state, schema) =>
    isImageSelected(state, schema.nodes["image"]!),
  inputRules: (schema) => {
    const imageType = schema.nodes["image"];
    return imageType ? [imageInputRule(imageType)] : [];
  },
  plugins: (schema) => {
    const imageType = schema.nodes["image"];
    if (!imageType) return [];
    return [
      new Plugin({
        props: {
          nodeViews: {
            image: (node, view, getPos) => new ImageNodeView(node, view, getPos),
          },
        },
      }),
    ];
  },
  toolbar: ImageToolbarItem,
  meta: { label: "Image", group: "block", Icon: ImageIcon },
});
