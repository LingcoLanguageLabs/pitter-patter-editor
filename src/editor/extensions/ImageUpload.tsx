import {
  ImageSquare,
  UploadSimple,
  Warning,
} from "@phosphor-icons/react";
import {
  useEditorEventCallback,
  useEditorState,
} from "@handlewithcare/react-prosemirror";
import type { Node as PmNode, NodeSpec, NodeType } from "prosemirror-model";
import {
  NodeSelection,
  Plugin,
  TextSelection,
  type Command,
  type EditorState,
} from "prosemirror-state";
import type { EditorView, NodeView } from "prosemirror-view";
import { useEffect, useRef, useState } from "react";

import { useEditor } from "../Editor";
import { MenuItem } from "../menu/MenuItem";
import { Extension } from "../types";

export interface ImageUploadOptions {
  /**
   * Upload a file and resolve to the URL where it can be served from.
   * Consumers wire this to their own storage (S3, Cloudinary, an
   * internal endpoint). When the promise resolves, the placeholder node
   * is replaced with a real `image` node carrying the URL.
   */
  upload: (file: File) => Promise<string>;
  /** MIME types accepted by the file picker. Default: image/*. */
  accept?: string;
}

const imageUploadSpec: NodeSpec = {
  group: "block",
  inline: false,
  atom: true,
  selectable: true,
  draggable: false,
  defining: true,
  isolating: true,
  attrs: {
    /** Stable id used to find this placeholder when the upload settles. */
    id: { default: "" },
    /** Optional label rendered while the upload is in flight. */
    label: { default: "" },
    /** Set to "uploading" or "error" to drive the NodeView's display. */
    state: { default: "idle" },
  },
  parseDOM: [{ tag: "div[data-image-upload]" }],
  toDOM(node) {
    return [
      "div",
      {
        "data-image-upload": "",
        "data-id": (node.attrs["id"] as string) || "",
        class: "pp-image-upload",
      },
    ];
  },
};

function isImageUploadSelected(state: EditorState | null, type: NodeType): boolean {
  if (!state) return false;
  const { selection } = state;
  return selection instanceof NodeSelection && selection.node.type === type;
}

function nextId(): string {
  return `pp-img-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Insert a placeholder upload node and immediately drive the upload
 * via the supplied uploader. When the upload settles, find the
 * placeholder by id and replace it with a real image node.
 */
function startImageUpload(
  view: EditorView,
  file: File,
  options: ImageUploadOptions,
): void {
  const uploadType = view.state.schema.nodes["image_upload"];
  const imageType = view.state.schema.nodes["image"];
  if (!uploadType || !imageType) return;

  const id = nextId();
  const placeholder = uploadType.create({
    id,
    label: file.name,
    state: "uploading",
  });
  view.dispatch(
    view.state.tr.replaceSelectionWith(placeholder).scrollIntoView(),
  );

  options.upload(file).then(
    (src) => replacePlaceholder(view, id, imageType, { src, alt: file.name }),
    (error) => markPlaceholderError(view, id, error),
  );
}

function findPlaceholder(doc: PmNode, id: string): { pos: number; node: PmNode } | null {
  let result: { pos: number; node: PmNode } | null = null;
  doc.descendants((node, pos) => {
    if (result) return false;
    if (node.type.name === "image_upload" && node.attrs["id"] === id) {
      result = { pos, node };
      return false;
    }
    return true;
  });
  return result;
}

function replacePlaceholder(
  view: EditorView,
  id: string,
  imageType: NodeType,
  attrs: { src: string; alt?: string },
): void {
  const found = findPlaceholder(view.state.doc, id);
  if (!found) return;
  const { pos, node } = found;
  view.dispatch(
    view.state.tr.replaceWith(pos, pos + node.nodeSize, imageType.create(attrs)),
  );
}

function markPlaceholderError(view: EditorView, id: string, error: unknown): void {
  // eslint-disable-next-line no-console
  console.error("[image-upload] failed", error);
  const found = findPlaceholder(view.state.doc, id);
  if (!found) return;
  const { pos, node } = found;
  view.dispatch(
    view.state.tr.setNodeMarkup(pos, undefined, {
      ...node.attrs,
      label: "Upload failed — click to retry",
      state: "error",
    }),
  );
}

// ────────────────────────────────────────────────── NodeView

class ImageUploadNodeView implements NodeView {
  dom: HTMLElement;
  private label: HTMLSpanElement;
  private icon: HTMLSpanElement;
  private fileInput: HTMLInputElement;
  private node: PmNode;
  private view: EditorView;
  private getPos: () => number | undefined;
  private options: ImageUploadOptions;
  private dragOver = false;

  constructor(
    node: PmNode,
    view: EditorView,
    getPos: () => number | undefined,
    options: ImageUploadOptions,
  ) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;
    this.options = options;

    this.dom = document.createElement("div");
    this.dom.className = "pp-image-upload-view";
    this.dom.dataset["state"] = "idle";

    this.icon = document.createElement("span");
    this.icon.className = "pp-image-upload-icon";
    this.icon.innerHTML = uploadIconSvg;

    this.label = document.createElement("span");
    this.label.className = "pp-image-upload-label";

    this.fileInput = document.createElement("input");
    this.fileInput.type = "file";
    this.fileInput.accept = options.accept ?? "image/*";
    this.fileInput.style.display = "none";
    this.fileInput.addEventListener("change", this.handleFileSelected);

    this.dom.appendChild(this.icon);
    this.dom.appendChild(this.label);
    this.dom.appendChild(this.fileInput);

    this.dom.addEventListener("click", this.handleClick);
    this.dom.addEventListener("dragenter", this.handleDragEnter);
    this.dom.addEventListener("dragleave", this.handleDragLeave);
    this.dom.addEventListener("dragover", this.handleDragOver);
    this.dom.addEventListener("drop", this.handleDrop);

    this.applyAttrs(node);
  }

  private handleClick = (event: Event) => {
    if (event.target === this.fileInput) return;
    this.fileInput.click();
  };

  private handleFileSelected = () => {
    const file = this.fileInput.files?.[0];
    this.fileInput.value = "";
    if (!file) return;
    this.runUpload(file);
  };

  private handleDragOver = (event: DragEvent) => {
    event.preventDefault();
    if (!this.dragOver) {
      this.dragOver = true;
      this.dom.dataset["dragover"] = "true";
    }
  };

  private handleDragEnter = (event: DragEvent) => {
    event.preventDefault();
    this.dragOver = true;
    this.dom.dataset["dragover"] = "true";
  };

  private handleDragLeave = (event: DragEvent) => {
    event.preventDefault();
    this.dragOver = false;
    delete this.dom.dataset["dragover"];
  };

  private handleDrop = (event: DragEvent) => {
    event.preventDefault();
    this.dragOver = false;
    delete this.dom.dataset["dragover"];
    const file = event.dataTransfer?.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    this.runUpload(file);
  };

  /**
   * Drive the upload from this placeholder — flip its state to
   * "uploading", run the consumer's upload, and replace this very
   * node with the resulting image when it settles.
   */
  private runUpload(file: File) {
    const pos = this.getPos();
    if (typeof pos !== "number") return;
    const id = (this.node.attrs["id"] as string) || nextId();
    this.view.dispatch(
      this.view.state.tr.setNodeMarkup(pos, undefined, {
        ...this.node.attrs,
        id,
        label: file.name,
        state: "uploading",
      }),
    );
    this.options.upload(file).then(
      (src) => {
        const imageType = this.view.state.schema.nodes["image"];
        if (!imageType) return;
        replacePlaceholder(this.view, id, imageType, {
          src,
          alt: file.name,
        });
      },
      (error) => markPlaceholderError(this.view, id, error),
    );
  }

  private applyAttrs(node: PmNode) {
    const label = (node.attrs["label"] as string) || "";
    const state = (node.attrs["state"] as string) || "idle";
    this.dom.dataset["state"] = state;
    if (state === "error") {
      this.label.textContent = label || "Upload failed";
      this.icon.innerHTML = errorIconSvg;
    } else if (state === "uploading") {
      this.label.textContent = label ? `Uploading ${label}…` : "Uploading…";
      this.icon.innerHTML = uploadIconSvg;
    } else {
      this.label.textContent = "Drop an image, or click to upload";
      this.icon.innerHTML = uploadIconSvg;
    }
  }

  update(node: PmNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.applyAttrs(node);
    return true;
  }

  stopEvent(event: Event): boolean {
    // Let the file input handle its own clicks.
    return event.target === this.fileInput;
  }

  destroy() {
    this.fileInput.removeEventListener("change", this.handleFileSelected);
    this.dom.removeEventListener("click", this.handleClick);
    this.dom.removeEventListener("dragenter", this.handleDragEnter);
    this.dom.removeEventListener("dragleave", this.handleDragLeave);
    this.dom.removeEventListener("dragover", this.handleDragOver);
    this.dom.removeEventListener("drop", this.handleDrop);
  }
}

// Phosphor SVG paths inlined so the NodeView doesn't pull React.
const uploadIconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256"><path d="M232,144v64a16,16,0,0,1-16,16H40a16,16,0,0,1-16-16V144a8,8,0,0,1,16,0v64H216V144a8,8,0,0,1,16,0Zm-101.66-5.66a8,8,0,0,0,11.32,0l40-40a8,8,0,0,0-11.32-11.32L136,108.69V24a8,8,0,0,0-16,0v84.69L85.66,87a8,8,0,0,0-11.32,11.32Z"></path></svg>
`;

const errorIconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256"><path d="M236.8,188.09,149.35,36.22a24.76,24.76,0,0,0-42.7,0L19.2,188.09a23.51,23.51,0,0,0,0,23.72A24.35,24.35,0,0,0,40.55,224h174.9a24.35,24.35,0,0,0,21.33-12.19A23.51,23.51,0,0,0,236.8,188.09ZM120,104a8,8,0,0,1,16,0v40a8,8,0,0,1-16,0Zm8,72a12,12,0,1,1,12-12A12,12,0,0,1,128,176Z"></path></svg>
`;

// ────────────────────────────────────────────────── Toolbar

interface ImageUploadToolbarItemProps {
  hasUploader: boolean;
}

function ImageUploadToolbarItem({ hasUploader }: ImageUploadToolbarItemProps) {
  const { schema } = useEditor();
  const editorState = useEditorState();
  const uploadType = schema.nodes["image_upload"];

  const insert = useEditorEventCallback((view) => {
    if (!view || !uploadType) return;
    insertImageUploadCommand(uploadType)(view.state, view.dispatch);
    view.focus();
  });

  if (!uploadType || !hasUploader) return null;
  const active = isImageUploadSelected(editorState, uploadType);

  return (
    <MenuItem
      active={active}
      onClick={() => insert()}
      tooltip="Upload image"
    >
      <UploadSimple size={18} weight="bold" />
    </MenuItem>
  );
}

// ────────────────────────────────────────────────── Commands

export function insertImageUploadCommand(uploadType: NodeType): Command {
  return (state, dispatch) => {
    if (dispatch) {
      dispatch(
        state.tr
          .replaceSelectionWith(
            uploadType.create({ id: nextId() }),
            false,
          )
          .scrollIntoView(),
      );
    }
    return true;
  };
}

// ────────────────────────────────────────────────── Extension factory

export function createImageUpload(options: ImageUploadOptions) {
  return Extension.create({
    name: "image-upload",
    nodes: { image_upload: imageUploadSpec },
    isActive: (state, schema) =>
      isImageUploadSelected(state, schema.nodes["image_upload"]!),
    plugins: (schema) => {
      const type = schema.nodes["image_upload"];
      if (!type) return [];
      return [
        new Plugin({
          props: {
            nodeViews: {
              image_upload: (node, view, getPos) =>
                new ImageUploadNodeView(node, view, getPos, options),
            },
            // Paste/drop an image directly into the editor → upload it.
            handlePaste(view, event) {
              const file = event.clipboardData?.files?.[0];
              if (!file || !file.type.startsWith("image/")) return false;
              event.preventDefault();
              startImageUpload(view, file, options);
              return true;
            },
            handleDrop(view, event) {
              const dragEvent = event as DragEvent;
              const file = dragEvent.dataTransfer?.files?.[0];
              if (!file || !file.type.startsWith("image/")) return false;
              event.preventDefault();
              const coords = view.posAtCoords({
                left: dragEvent.clientX,
                top: dragEvent.clientY,
              });
              if (coords) {
                view.dispatch(
                  view.state.tr.setSelection(
                    TextSelection.near(view.state.doc.resolve(coords.pos)),
                  ),
                );
              }
              startImageUpload(view, file, options);
              return true;
            },
          },
        }),
      ];
    },
    toolbar: () => <ImageUploadToolbarItem hasUploader />,
    meta: { label: "Upload image", group: "block", Icon: UploadSimple },
  });
}

/**
 * A development-only helper that simulates a remote upload using a
 * data URL and a configurable delay. Pass to `createImageUpload({
 * upload: simulateUpload })` for stories or local demos. Don't ship to
 * production — data URLs bloat the document.
 */
export function simulateUpload(delayMs = 1200): ImageUploadOptions["upload"] {
  return (file) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        setTimeout(() => resolve(reader.result as string), delayMs);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
}
