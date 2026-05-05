import { Image as ImageIcon, UploadSimple } from "@phosphor-icons/react";
import {
  useEditorEventCallback,
  useEditorState,
} from "@handlewithcare/react-prosemirror";
import * as RadixPopover from "@radix-ui/react-popover";
import type { NodeType } from "prosemirror-model";
import { schema as basicSchema } from "prosemirror-schema-basic";
import type { Command, EditorState } from "prosemirror-state";
import { NodeSelection } from "prosemirror-state";
import { useRef, useState } from "react";

import { useEditor } from "../Editor";
import { MenuItem } from "../menu/MenuItem";
import { Extension } from "../types";

const imageSpec = basicSchema.spec.nodes.get("image");
if (!imageSpec) throw new Error("image node missing from basic schema");

function insertImage(
  imageType: NodeType,
  attrs: { src: string; alt?: string; title?: string },
): Command {
  return (state, dispatch) => {
    if (dispatch) {
      dispatch(state.tr.replaceSelectionWith(imageType.create(attrs)).scrollIntoView());
    }
    return true;
  };
}

function isImageSelected(state: EditorState | null, imageType: NodeType): boolean {
  if (!state) return false;
  const { selection } = state;
  if (!(selection instanceof NodeSelection)) return false;
  return selection.node.type === imageType;
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function ImageToolbarItem() {
  const { schema } = useEditor();
  const editorState = useEditorState();
  const imageType = schema.nodes["image"];
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [alt, setAlt] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const insertFromUrl = useEditorEventCallback((view, src: string, altText: string) => {
    if (!view || !imageType || !src) return;
    insertImage(imageType, { src, alt: altText || undefined })(view.state, view.dispatch);
    view.focus();
  });

  const insertFromFile = useEditorEventCallback((view, dataUrl: string, altText: string) => {
    if (!view || !imageType) return;
    insertImage(imageType, { src: dataUrl, alt: altText || undefined })(view.state, view.dispatch);
    view.focus();
  });

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

export const Image = Extension.create({
  name: "image",
  nodes: { image: imageSpec },
  isActive: (state, schema) => isImageSelected(state, schema.nodes["image"]!),
  toolbar: ImageToolbarItem,
  meta: { label: "Image", group: "block", Icon: ImageIcon },
});
