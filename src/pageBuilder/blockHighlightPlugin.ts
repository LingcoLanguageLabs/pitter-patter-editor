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
 *   • shift+click adds/removes a block from the selection (multi-select).
 *     Single-block UI (settings popover, resize handles) keys off
 *     `getActiveBlockPos`, which is null while more than one block is
 *     selected — so it hides itself automatically; the context menu is
 *     the way to act on a multi-selection.
 *   • right-click keeps a multi-selection when it lands on a member
 *     (so the context menu can act on it), otherwise selects the
 *     clicked block.
 *   • pointerdown on the gutter (resolves up to the editor root),
 *     a click anywhere outside the editor + toolbar + handles, or
 *     Escape clears it.
 *   • a shuffle drag clears it and keeps it cleared past the drop, until
 *     the next click.
 *
 * Everything that should track "the active block" reads `activePos`:
 *   • this plugin paints the `.pb-block-active` ring on every selected
 *     block,
 *   • `BlockSettings` shows its toolbar for it,
 *   • `Editor` only renders shuffle's `ResizeHandles` while it's set.
 *
 * Hover highlighting is separate (shuffle's `hoverDecorations`, see
 * Editor.tsx); both paint the same ring via one shared CSS rule
 * (`.pb-block-hovered, .pb-block-active`), mirroring pagy's single
 * `.highlight` rule surfaced through `-active`/`-selected` modifiers.
 */

import {
  Plugin,
  PluginKey,
  TextSelection,
  type EditorState,
  type Transaction,
} from "prosemirror-state";
import { Decoration, DecorationSet, type EditorView } from "prosemirror-view";
import { shufflePluginKey } from "@pitter-patter/shuffle";

interface HighlightState {
  /** Doc positions (before-node) of the explicitly selected blocks. */
  selected: number[];
  /** True when the selection was made by right-click / a context-menu
   *  action: the ring shows, but the settings popover stays closed —
   *  the context menu is the UI for that interaction. A later plain
   *  click re-selects loudly. */
  quiet: boolean;
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
 * Null while the selection holds more (or fewer) than one block — the
 * single-block UI keys off this, so a multi-select hides it for free.
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
  const selected = blockHighlightKey.getState(state)?.selected ?? [];
  return selected.length === 1 ? selected[0]! : null;
}

/** All explicitly selected block positions (before-node), in click
 *  order. Empty when nothing is selected. */
export function getSelectedBlockPositions(state: EditorState): number[] {
  return blockHighlightKey.getState(state)?.selected ?? [];
}

/** True when the current selection is "quiet" (made by right-click or
 *  a context-menu action) — the settings popover suppresses itself. */
export function isQuietSelection(state: EditorState): boolean {
  return blockHighlightKey.getState(state)?.quiet ?? false;
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
 * inner block. Sets the same `selected` everything else reads.
 */
export function selectBlockPos(view: EditorView, pos: number | null): void {
  view.dispatch(
    view.state.tr.setMeta(blockHighlightKey, {
      selected: pos == null ? [] : [pos],
      quiet: false,
    } as HighlightMeta),
  );
}

/**
 * Stamp `tr` so the explicit block selection points at `positions`
 * after the transaction applies — the meta wins over `apply`'s
 * position mapping. Pass post-transaction positions.
 *
 * Needed by anything that replaces a selected node in place via
 * `setNodeMarkup` (type/level conversion): that's a ReplaceAroundStep,
 * and mapping the before-node position through it reports `deleted`
 * (the node's open token was swapped), which would clear the selection
 * even though a block still lives at the same position.
 *
 * `quiet: true` keeps the settings popover suppressed — pass it from
 * context-menu actions so a right-click flow never spawns the popover.
 */
export function setSelectedBlocks(
  tr: Transaction,
  positions: number[],
  quiet = false,
): Transaction {
  return tr.setMeta(blockHighlightKey, {
    selected: positions,
    quiet,
  } as HighlightMeta);
}

/** Clicks on these keep the selection alive — they're part of the block
 *  UI, not a "click off". The toolbar popover and shuffle's handles all
 *  live outside the editor DOM, so a plain outside-click check would
 *  otherwise treat interacting with them as a dismissal. */
const KEEP_ALIVE_SELECTOR =
  ".pb-block-settings, .pb-type-menu, .pb-context-menu, .pb-text-toolbar, .pb-link-popover, .pb-scrub-menu, .pb-space, .shuffle-drag-handle, .shuffle-left-resize-handle, .shuffle-right-resize-handle";

/**
 * True when a pointer event lands inside the current (non-collapsed)
 * text selection. Right-click flows check this to step aside: over
 * selected text, the browser's native Cut/Copy/Paste menu is the UI —
 * neither the block context menu nor the quiet block selection should
 * hijack it (pagy shows the native menu there too).
 *
 * Tested geometrically against the painted DOM selection rects — "did
 * the click land on highlighted text" — which is also what the browser
 * itself keys Copy on. (`view.posAtCoords` is unreliable over a
 * native selection: it can report pos 0 for points squarely inside a
 * selected text run.)
 */
export function isPointInTextSelection(
  view: EditorView,
  event: MouseEvent,
): boolean {
  const sel = view.state.selection;
  if (sel.empty || !(sel instanceof TextSelection)) return false;
  const domSel = view.dom.ownerDocument.getSelection();
  if (!domSel || domSel.isCollapsed) return false;
  const { clientX: x, clientY: y } = event;
  for (let i = 0; i < domSel.rangeCount; i++) {
    for (const rect of domSel.getRangeAt(i).getClientRects()) {
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return true;
      }
    }
  }
  return false;
}

function samePositions(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((pos, i) => pos === b[i]);
}

export function blockHighlightPlugin() {
  return new Plugin<HighlightState>({
    key: blockHighlightKey,
    state: {
      init: () => ({ selected: [], quiet: false, resizing: false }),
      apply(tr, value, _oldState, newState) {
        const meta = tr.getMeta(blockHighlightKey) as HighlightMeta | undefined;
        let selected =
          meta && "selected" in meta ? meta.selected! : value.selected;
        const quiet =
          meta && "selected" in meta ? (meta.quiet ?? false) : value.quiet;
        const resizing =
          meta && "resizing" in meta ? meta.resizing! : value.resizing;
        // Keep the rings glued to their blocks across edits (e.g. resize).
        if (!(meta && "selected" in meta) && selected.length && tr.docChanged) {
          const mapped = selected
            .map((pos) => tr.mapping.mapResult(pos))
            .filter((result) => !result.deleted)
            .map((result) => result.pos);
          selected = [...new Set(mapped)];
        }
        // A shuffle drag clears the selection and keeps it cleared past
        // the drop (until the next click) — mirrors pagy on drag start.
        if (shufflePluginKey.getState(newState)?.activeNodePos != null) {
          selected = [];
        }
        return { selected, quiet, resizing };
      },
    },
    props: {
      decorations(state) {
        const positions = getSelectedBlockPositions(state);
        if (!positions.length) return DecorationSet.empty;
        const decos: Decoration[] = [];
        for (const pos of positions) {
          const node = state.doc.nodeAt(pos);
          if (!node) continue;
          decos.push(
            Decoration.node(pos, pos + node.nodeSize, {
              class: "pb-block-active",
            }),
          );
        }
        return DecorationSet.create(state.doc, decos);
      },
    },
    view(editorView) {
      const setMeta = (meta: HighlightMeta) => {
        editorView.dispatch(editorView.state.tr.setMeta(blockHighlightKey, meta));
      };
      const select = (positions: number[], quiet = false) => {
        if (
          samePositions(getSelectedBlockPositions(editorView.state), positions) &&
          isQuietSelection(editorView.state) === quiet
        )
          return;
        setMeta({ selected: positions, quiet });
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
        // Right-click on the live text selection: hands off entirely —
        // the native Cut/Copy/Paste menu owns it (see
        // isPointInTextSelection). Selecting a block here would also
        // clobber the text selection the user is about to copy.
        if (event.button === 2 && isPointInTextSelection(editorView, event)) {
          return;
        }
        const target = event.target as HTMLElement | null;
        const blockEl = target?.closest(".shuffle-block") ?? null;
        if (!blockEl || blockEl === editorView.dom) {
          // Right-click on the gutter: leave the selection alone so the
          // native menu shows without nuking a multi-select in progress.
          if (event.button !== 0) return;
          select([]);
          event.preventDefault();
          editorView.dom.blur();
          return;
        }
        const desc = (blockEl as HTMLElement & {
          pmViewDesc?: { posBefore: number };
        }).pmViewDesc;
        if (!desc) {
          select([]);
          return;
        }
        const pos = desc.posBefore;
        const current = getSelectedBlockPositions(editorView.state);

        // Right-click: keep the selection when it lands on a member OR
        // inside one (a selected container's children fill its box, so
        // a click "on the container" always resolves to an inner block
        // — stealing the selection would make container actions
        // unreachable). Otherwise select the clicked block. Either way
        // the selection goes quiet: the context menu is the UI here,
        // not the settings popover.
        if (event.button === 2) {
          const insideSelection = current.some((selectedPos) => {
            if (selectedPos === pos) return true;
            const node = editorView.state.doc.nodeAt(selectedPos);
            return (
              node != null &&
              pos > selectedPos &&
              pos < selectedPos + node.nodeSize
            );
          });
          select(insideSelection ? current : [pos], true);
          return;
        }

        // Shift+click toggles the block in/out of the selection. Block
        // the default so the browser doesn't extend a text selection
        // across blocks.
        if (event.shiftKey) {
          event.preventDefault();
          select(
            current.includes(pos)
              ? current.filter((p) => p !== pos)
              : [...current, pos],
          );
          return;
        }

        select([pos]);
      };

      // Clicks fully outside the editor (chrome, side panels) clear the
      // selection, unless they land on the toolbar or a handle.
      const onClick = (event: MouseEvent) => {
        const target = event.target as HTMLElement | null;
        if (!target) return;
        if (editorView.dom.contains(target)) return;
        if (target.closest(KEEP_ALIVE_SELECTOR)) return;
        select([]);
      };

      const onKey = (event: KeyboardEvent) => {
        if (event.key === "Escape") select([]);
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
