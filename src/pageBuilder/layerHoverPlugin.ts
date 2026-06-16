/**
 * Layer-hover highlight — Figma-style "hover a layer row, ring it on canvas".
 *
 * Holds one hovered doc position (set from the Layers panel via `setLayerHover`
 * through the stashed view) and paints the same accent ring shuffle uses for
 * its own hover (`pb-block-hovered`), so a panel hover and a canvas hover look
 * identical. Independent of selection + shuffle's DOM-driven hover.
 *
 * A node on an inactive page renders no DOM (`PageNodeView` gating), so its
 * decoration simply doesn't paint — hovering an off-screen layer is a no-op on
 * the canvas, which is the right behavior (only the active slide is shown).
 */

import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet, type EditorView } from "prosemirror-view";

interface LayerHoverState {
  /** Doc position (before-node) of the hovered layer, or null. */
  pos: number | null;
}

export const layerHoverKey = new PluginKey<LayerHoverState>("pb-layer-hover");

/** Ring the node starting at `pos` (or clear with null). No-op when unchanged
 *  so a stream of pointer events doesn't thrash transactions. */
export function setLayerHover(view: EditorView, pos: number | null): void {
  const current = layerHoverKey.getState(view.state)?.pos ?? null;
  if (current === pos) return;
  view.dispatch(view.state.tr.setMeta(layerHoverKey, { pos }));
}

export function layerHoverPlugin() {
  return new Plugin<LayerHoverState>({
    key: layerHoverKey,
    state: {
      init: () => ({ pos: null }),
      apply(tr, value) {
        const meta = tr.getMeta(layerHoverKey) as LayerHoverState | undefined;
        if (meta) return meta;
        // Keep the ring glued to its node across edits.
        if (value.pos != null && tr.docChanged) {
          const result = tr.mapping.mapResult(value.pos);
          return { pos: result.deleted ? null : result.pos };
        }
        return value;
      },
    },
    props: {
      decorations(state) {
        const pos = layerHoverKey.getState(state)?.pos ?? null;
        if (pos == null) return DecorationSet.empty;
        const node = state.doc.nodeAt(pos);
        if (!node) return DecorationSet.empty;
        return DecorationSet.create(state.doc, [
          Decoration.node(pos, pos + node.nodeSize, {
            class: "pb-block-hovered",
          }),
        ]);
      },
    },
  });
}
