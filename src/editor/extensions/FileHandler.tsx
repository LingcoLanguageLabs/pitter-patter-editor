import { Plugin } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";

import { Extension } from "../types";

export interface FileHandlerOptions {
  /**
   * MIME types accepted. Supports exact match (`image/png`) and
   * wildcards (`image/*`). When omitted, every File is forwarded.
   */
  allowedMimeTypes?: readonly string[];
  /**
   * Called when files are pasted via the system clipboard. Return
   * `true` to indicate the event was handled and stop further
   * ProseMirror processing.
   */
  onPaste?: (
    files: File[],
    view: EditorView,
    event: ClipboardEvent,
  ) => boolean | void;
  /**
   * Called when files are dropped onto the editor. Receives the
   * resolved doc position under the drop coordinates (or `null` if it
   * couldn't be resolved). Return `true` to stop further processing.
   */
  onDrop?: (
    files: File[],
    view: EditorView,
    event: DragEvent,
    pos: number | null,
  ) => boolean | void;
}

function matchesMime(file: File, pattern: string): boolean {
  if (pattern === file.type) return true;
  if (pattern.endsWith("/*")) {
    return file.type.startsWith(pattern.slice(0, -1));
  }
  if (pattern === "*") return true;
  return false;
}

function filterFiles(
  list: FileList | null | undefined,
  allowed: readonly string[] | undefined,
): File[] {
  if (!list || list.length === 0) return [];
  const arr = Array.from(list);
  if (!allowed || allowed.length === 0) return arr;
  return arr.filter((f) => allowed.some((p) => matchesMime(f, p)));
}

/**
 * Generic paste/drop file handler. Consumers wire `onPaste`/`onDrop`
 * to upload, embed, or otherwise route files. The default-exported
 * `FileHandler` is a no-op skeleton; call `createFileHandler({...})`
 * to register your callbacks.
 */
export function createFileHandler(options: FileHandlerOptions = {}) {
  return Extension.create({
    name: "file-handler",
    plugins: () => [
      new Plugin({
        props: {
          handlePaste(view, event) {
            const files = filterFiles(
              event.clipboardData?.files,
              options.allowedMimeTypes,
            );
            if (files.length === 0) return false;
            const result = options.onPaste?.(files, view, event);
            return result === true;
          },
          handleDrop(view, event) {
            const dragEvent = event as DragEvent;
            const files = filterFiles(
              dragEvent.dataTransfer?.files,
              options.allowedMimeTypes,
            );
            if (files.length === 0) return false;
            const coords = view.posAtCoords({
              left: dragEvent.clientX,
              top: dragEvent.clientY,
            });
            const pos = coords ? coords.pos : null;
            const result = options.onDrop?.(files, view, dragEvent, pos);
            return result === true;
          },
        },
      }),
    ],
    meta: { label: "File handler", group: "system" },
  });
}

export const FileHandler = createFileHandler();
