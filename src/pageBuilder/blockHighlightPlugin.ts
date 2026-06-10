/**
 * Explicit block selection + its highlight ring.
 *
 * ProseMirror always has a text selection somewhere, so it can't model
 * "nothing selected" — clicking the section gutter just snaps the
 * cursor to the nearest block. That's why clicking a gutter used to
 * "activate" a block: shuffle's resize handles and our toolbar keyed off
 * the raw selection. So we keep our own pagy-style `selectedBlock` here:
 *
 *   • pointerdown on a content block (`.shuffle-block` that isn't the
 *     editor root) selects it.
 *   • pointerdown on the gutter (resolves up to the editor root),
 *     a click anywhere outside the editor + toolbar + handles, or
 *     Escape clears it.
 *   • a shuffle drag clears it and keeps it cleared past the drop, until
 *     the next click.
 *
 * Everything that should track "the active block" reads `activePos`:
 *   • this plugin paints the `.pb-block-active` ring on it,
 *   • `BlockSettings` shows its toolbar for it,
 *   • `Editor` only renders shuffle's `ResizeHandles` while it's set.
 *
 * Hover highlighting is separate (shuffle's `hoverDecorations`, see
 * Editor.tsx); both paint the same ring via one shared CSS rule
 * (`.pb-block-hovered, .pb-block-active`), mirroring pagy's single
 * `.highlight` rule surfaced through `-active`/`-selected` modifiers.
 */

import { Plugin, PluginKey, type EditorState } from "prosemirror-state";
import { Decoration, DecorationSet, type EditorView } from "prosemirror-view";
import { shufflePluginKey } from "@pitter-patter/shuffle";

interface HighlightState {
  activePos: number | null;
  /** True while a shuffle resize handle is held. Keeps the ring up but
   *  hides the settings toolbar, like pagy's `resizedBlock`. */
  resizing: boolean;
}

type HighlightMeta = Partial<HighlightState>;

export const blockHighlightKey = new PluginKey<HighlightState>(
  "pb-block-highlight",
);

/**
 * Doc position (before-node) of the explicitly selected block, or null.
 *
 * Migration seam — when shuffle ships an owned "selected block" (the
 * `selectedPos` + set/clear command we asked for), this should read
 * `shufflePluginKey.getState(state)?.selectedPos`, and the click-driven
 * selection in `view()` below (`onMouseDown`) + the `ActiveResizeHandles`
 * gate in Editor.tsx can go away. Keep all callers reading THIS function
 * so that swap stays a one-liner.
 * TODO(shuffle selectedPos API): replace body with shuffle plugin state.
 */
export function getActiveBlockPos(state: EditorState): number | null {
  return blockHighlightKey.getState(state)?.activePos ?? null;
}

/**
 * True while the selected block is being resized (a handle is held).
 *
 * Migration seam — when shuffle ships a `resizing` flag in its plugin
 * state, this should read `shufflePluginKey.getState(state)?.resizing`,
 * and the DOM resize detection in `view()` below (the `onResizeStart`
 * listener + the `resizing` field on our state) can be deleted. Keep all
 * callers reading THIS function so that swap stays a one-liner.
 * TODO(shuffle resizing API): replace body with shuffle plugin state.
 */
export function isBlockResizing(state: EditorState): boolean {
  return blockHighlightKey.getState(state)?.resizing ?? false;
}

/**
 * Select the block whose node starts at `pos` (its before-position), or clear
 * with `null`. `SelectableDragHandle` calls this so clicking a block's
 * drag-handle pill selects it — the only reliable way to select a container,
 * since its children fill its box and a body click always resolves to the
 * inner block. Sets the same `activePos` everything else reads.
 */
export function selectBlockPos(view: EditorView, pos: number | null): void {
  view.dispatch(
    view.state.tr.setMeta(blockHighlightKey, { activePos: pos } as HighlightMeta),
  );
}

/** Clicks on these keep the selection alive — they're part of the block
 *  UI, not a "click off". The toolbar popover and shuffle's handles all
 *  live outside the editor DOM, so a plain outside-click check would
 *  otherwise treat interacting with them as a dismissal. */
const KEEP_ALIVE_SELECTOR =
  ".pb-block-settings, .pb-type-menu, .shuffle-drag-handle, .shuffle-left-resize-handle, .shuffle-right-resize-handle";

export function blockHighlightPlugin() {
  return new Plugin<HighlightState>({
    key: blockHighlightKey,
    state: {
      init: () => ({ activePos: null, resizing: false }),
      apply(tr, value, _oldState, newState) {
        const meta = tr.getMeta(blockHighlightKey) as HighlightMeta | undefined;
        let activePos =
          meta && "activePos" in meta ? meta.activePos! : value.activePos;
        const resizing =
          meta && "resizing" in meta ? meta.resizing! : value.resizing;
        // Keep the ring glued to its block across edits (e.g. resize).
        if (!(meta && "activePos" in meta) && activePos != null && tr.docChanged) {
          const mapped = tr.mapping.mapResult(activePos);
          activePos = mapped.deleted ? null : mapped.pos;
        }
        // A shuffle drag clears the selection and keeps it cleared past
        // the drop (until the next click) — mirrors pagy on drag start.
        if (shufflePluginKey.getState(newState)?.activeNodePos != null) {
          activePos = null;
        }
        return { activePos, resizing };
      },
    },
    props: {
      decorations(state) {
        const pos = getActiveBlockPos(state);
        if (pos == null) return DecorationSet.empty;
        const node = state.doc.nodeAt(pos);
        if (!node) return DecorationSet.empty;
        return DecorationSet.create(state.doc, [
          Decoration.node(pos, pos + node.nodeSize, {
            class: "pb-block-active",
          }),
        ]);
      },
    },
    view(editorView) {
      const setMeta = (meta: HighlightMeta) => {
        editorView.dispatch(editorView.state.tr.setMeta(blockHighlightKey, meta));
      };
      const select = (pos: number | null) => {
        if (getActiveBlockPos(editorView.state) === pos) return;
        setMeta({ activePos: pos });
      };

      // Select the clicked block; clear when the click lands in the
      // gutter (which resolves up to the editor root — see file header).
      //
      // Listen on `mousedown` (not pointerdown) because that's the event
      // that drives contenteditable caret placement. On a gutter click
      // we `preventDefault()` so the browser/PM don't snap a text caret
      // into the nearest block, and `blur()` to drop any caret left from
      // a previous block click — otherwise a cursor keeps blinking in a
      // block that isn't active. (pagy blurs on click-off the same way.)
      const onMouseDown = (event: MouseEvent) => {
        const target = event.target as HTMLElement | null;
        const blockEl = target?.closest(".shuffle-block") ?? null;
        if (!blockEl || blockEl === editorView.dom) {
          select(null);
          event.preventDefault();
          editorView.dom.blur();
          return;
        }
        const desc = (blockEl as HTMLElement & {
          pmViewDesc?: { posBefore: number };
        }).pmViewDesc;
        select(desc ? desc.posBefore : null);
      };

      // Clicks fully outside the editor (chrome, side panels) clear the
      // selection, unless they land on the toolbar or a handle.
      const onClick = (event: MouseEvent) => {
        const target = event.target as HTMLElement | null;
        if (!target) return;
        if (editorView.dom.contains(target)) return;
        if (target.closest(KEEP_ALIVE_SELECTOR)) return;
        select(null);
      };

      const onKey = (event: KeyboardEvent) => {
        if (event.key === "Escape") select(null);
      };

      // DOM resize detection — throwaway once shuffle exposes `resizing`.
      // Grabbing a shuffle resize handle flags `resizing`, which hides
      // the toolbar while keeping the ring (mirroring pagy suppressing
      // its popover via `resizedBlock`). The handles render outside the
      // editor DOM, so we listen on the document.
      //
      // We end the resize on pointerup AND pointercancel AND window blur,
      // so the flag can't get stuck `true` if the pointer is released
      // off-window — which would otherwise hide the toolbar until the
      // next click. `endResize` removes whichever of these is pending.
      // TODO(shuffle resizing API): delete this block; read shuffle state.
      let endResize: (() => void) | null = null;
      const onResizeStart = (event: PointerEvent) => {
        const target = event.target as HTMLElement | null;
        if (
          !target?.closest(
            ".shuffle-left-resize-handle, .shuffle-right-resize-handle",
          )
        ) {
          return;
        }
        endResize?.(); // defensively close any prior in-flight resize
        const finish = () => {
          endResize?.();
          setMeta({ resizing: false });
        };
        endResize = () => {
          document.removeEventListener("pointerup", finish, true);
          document.removeEventListener("pointercancel", finish, true);
          window.removeEventListener("blur", finish);
          endResize = null;
        };
        document.addEventListener("pointerup", finish, true);
        document.addEventListener("pointercancel", finish, true);
        window.addEventListener("blur", finish);
        setMeta({ resizing: true });
      };

      editorView.dom.addEventListener("mousedown", onMouseDown);
      document.addEventListener("pointerdown", onResizeStart, true);
      document.addEventListener("click", onClick, true);
      document.addEventListener("keydown", onKey);
      return {
        destroy() {
          endResize?.(); // tear down listeners if unmounted mid-resize
          editorView.dom.removeEventListener("mousedown", onMouseDown);
          document.removeEventListener("pointerdown", onResizeStart, true);
          document.removeEventListener("click", onClick, true);
          document.removeEventListener("keydown", onKey);
        },
      };
    },
  });
}
