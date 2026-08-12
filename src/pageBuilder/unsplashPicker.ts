/**
 * Unsplash picker — editor-side state for the page builder's photo picker.
 *
 * A tiny ProseMirror plugin holding the picker's open flag + the doc target it
 * will write to, plus the commands that open/close it and apply a chosen photo.
 * The picker UI itself is the left-panel "Photos" sheet (`panels/PhotosPanel`),
 * which lives OUTSIDE the editor's React context — so it reads `{open}` from the
 * zustand store (mirrored here by `editorStoreSync`) and dispatches `apply`
 * through the stashed `pagesView`, the same bridge the Pages/Layers panels use.
 *
 * Two ways in (both from the "Unsplash" catalog block):
 *   • CLICK  → `openInsert(pos)`  — no node yet; the pick INSERTS an image at
 *              `pos` (the end of the section the block was added from).
 *   • DRAG   → shuffle inflate drops a placeholder image (empty `src` +
 *              `unsplashPending`); its NodeView calls `openFill(pos)` on mount;
 *              the pick SETS that image's `src`.
 *
 * The target `pos` is remapped across every transaction so concurrent edits
 * (or the placeholder drop itself) can't leave it pointing at the wrong node.
 */

import type { Node as PmNode, Schema } from "prosemirror-model";
import { Plugin, PluginKey, type Command } from "prosemirror-state";

// ────────────────────────────────────────────────────────────── Catalog block

/** The pseudo node-type the "Unsplash" catalog entry carries. It has NO schema
 *  node of its own — the chrome special-cases it: click opens the picker,
 *  drag drops an `image` placeholder (see `buildUnsplashPlaceholder`). */
export const UNSPLASH_BLOCK_TYPE = "unsplash";

export function isUnsplashEntry(entry: { type: string }): boolean {
  return entry.type === UNSPLASH_BLOCK_TYPE;
}

/** The image placeholder used as the drag (shuffle inflate) payload for the
 *  Unsplash catalog block: empty `src`, `unsplashPending` set so its NodeView
 *  auto-opens the picker once dropped. Carries the required caption child. */
export function buildUnsplashPlaceholder(schema: Schema): PmNode | null {
  const imageType = schema.nodes["image"];
  const captionType = schema.nodes["image_caption"];
  if (!imageType || !captionType) return null;
  return imageType.create(
    { src: "", alt: "", aspect: "16/9", unsplashPending: true },
    captionType.create(),
  );
}

// ────────────────────────────────────────────────────────────── Types

/** The normalized photo shape the backend (`/api/unsplash`) returns. */
export interface UnsplashPhoto {
  id: string;
  urls: { thumb?: string; small?: string; regular?: string; full?: string };
  description: string | null;
  alt_description: string | null;
  user: { name: string; links: { html: string } };
  links: { html: string; download_location?: string };
}

export type UnsplashTarget =
  /** Insert a brand-new image at `pos` (click-from-catalog). */
  | { mode: "insert"; pos: number }
  /** Fill the existing placeholder image at `pos` (drag-from-catalog). */
  | { mode: "fill"; pos: number };

export interface UnsplashPickerState {
  open: boolean;
  target: UnsplashTarget | null;
}

export const unsplashPluginKey = new PluginKey<UnsplashPickerState>(
  "pb-unsplash-picker",
);

const CLOSED: UnsplashPickerState = { open: false, target: null };

type UnsplashMeta =
  | { type: "open"; target: UnsplashTarget }
  | { type: "close" };

// ────────────────────────────────────────────────────────────── Plugin

export function unsplashPickerPlugin(): Plugin<UnsplashPickerState> {
  return new Plugin<UnsplashPickerState>({
    key: unsplashPluginKey,
    state: {
      init: () => CLOSED,
      apply(tr, prev) {
        const meta = tr.getMeta(unsplashPluginKey) as UnsplashMeta | undefined;
        if (meta?.type === "open") return { open: true, target: meta.target };
        if (meta?.type === "close") return CLOSED;
        // No meta — keep the target valid across the edit.
        if (prev.target && tr.docChanged) {
          return {
            ...prev,
            target: { ...prev.target, pos: tr.mapping.map(prev.target.pos) },
          };
        }
        return prev;
      },
    },
  });
}

// ────────────────────────────────────────────────────────────── Commands

/** Open the picker to INSERT a new image at `pos` (no placeholder). */
export function unsplashOpenInsert(pos: number): Command {
  return (state, dispatch) => {
    dispatch?.(
      state.tr.setMeta(unsplashPluginKey, {
        type: "open",
        target: { mode: "insert", pos },
      } satisfies UnsplashMeta),
    );
    return true;
  };
}

/** Open the picker to FILL the existing placeholder image at `pos`. */
export function unsplashOpenFill(pos: number): Command {
  return (state, dispatch) => {
    dispatch?.(
      state.tr.setMeta(unsplashPluginKey, {
        type: "open",
        target: { mode: "fill", pos },
      } satisfies UnsplashMeta),
    );
    return true;
  };
}

/**
 * Called by a freshly-dropped placeholder's NodeView: open the picker to fill
 * THIS image and clear the `unsplashPending` marker in the same step, so a
 * re-mount can't re-open it. Off-history — the shuffle drop is the undoable
 * action; auto-opening the picker shouldn't be separately undoable.
 */
export function unsplashClaimPlaceholder(pos: number): Command {
  return (state, dispatch) => {
    if (!dispatch) return true;
    const tr = state.tr
      .setMeta(unsplashPluginKey, {
        type: "open",
        target: { mode: "fill", pos },
      } satisfies UnsplashMeta)
      .setNodeAttribute(pos, "unsplashPending", false)
      .setMeta("addToHistory", false);
    dispatch(tr);
    return true;
  };
}

export function unsplashClose(): Command {
  return (state, dispatch) => {
    dispatch?.(
      state.tr.setMeta(unsplashPluginKey, { type: "close" } satisfies UnsplashMeta),
    );
    return true;
  };
}

/** Best image URL the picker should commit, largest-first. Exported so any
 *  other Unsplash-picking UI (`UnsplashBrowser`, `ImagePicker`'s Unsplash tab)
 *  resolves a photo to a src/alt the same way. */
export function pickSrc(photo: UnsplashPhoto): string {
  return photo.urls.regular ?? photo.urls.full ?? photo.urls.small ?? "";
}

export function pickAlt(photo: UnsplashPhoto): string {
  return photo.alt_description ?? photo.description ?? "";
}

/**
 * Apply a chosen photo to the current target, then close. Insert mode builds a
 * fresh image node (with its required empty caption child); fill mode writes
 * `src`/`alt` onto the placeholder and clears `unsplashPending`. No-ops cleanly
 * if the target node has gone (e.g. the placeholder was deleted mid-pick).
 */
export function unsplashApply(photo: UnsplashPhoto): Command {
  return (state, dispatch) => {
    const ui = unsplashPluginKey.getState(state);
    const target = ui?.target;
    if (!target) return false;
    const src = pickSrc(photo);
    if (!src) return false;
    const alt = pickAlt(photo);

    if (!dispatch) return true;
    const tr = state.tr;

    if (target.mode === "fill") {
      const node = state.doc.nodeAt(target.pos);
      if (!node || node.type.name !== "image") {
        // Placeholder vanished — just close.
        dispatch(tr.setMeta(unsplashPluginKey, { type: "close" }));
        return true;
      }
      tr.setNodeAttribute(target.pos, "src", src);
      tr.setNodeAttribute(target.pos, "alt", alt);
      tr.setNodeAttribute(target.pos, "unsplashPending", false);
    } else {
      const imageType = state.schema.nodes["image"];
      const captionType = state.schema.nodes["image_caption"];
      if (!imageType || !captionType) return false;
      const node = imageType.create(
        { src, alt, aspect: "16/9" },
        captionType.create(),
      );
      tr.insert(target.pos, node);
    }

    tr.setMeta(unsplashPluginKey, { type: "close" } satisfies UnsplashMeta);
    dispatch(tr.scrollIntoView());
    return true;
  };
}
