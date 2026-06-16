/**
 * Block top-margin drag handle — pagy's `margin-handle`, rebuilt on PM attrs.
 * A hatched band sits in the space ABOVE the active block; dragging it sets
 * that block's `margin` (top-margin px). Pagy's 2× feel: drag 32px → 64px.
 *
 * Shows for the single explicitly-selected block (the same `getActiveBlockPos`
 * the resize handles + settings toolbar key off), and only in a vertical stack
 * — not on a row cell or a first child, where a top margin has no meaning the
 * section's own padding doesn't already cover (pagy gates it the same way).
 *
 * Body-portaled and fixed-positioned (tracked off the block's client rect),
 * like `BlockSettings` — it draws in the row-gap region, outside the content
 * flow and `contentDOM`, so shuffle's drop math never sees it. Margin is
 * vertical; shuffle owns the horizontal grid; they don't interact.
 */

"use client";

import {
  useEditorEffect,
  useEditorEventCallback,
  useEditorState,
} from "@handlewithcare/react-prosemirror";
import { ArrowCounterClockwise } from "@phosphor-icons/react";
import { shufflePluginKey } from "@pitter-patter/shuffle";
import type { EditorView } from "prosemirror-view";
import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import type { EditorState } from "prosemirror-state";

import { getActiveBlockPos, isBlockResizing } from "./blockHighlightPlugin";
import { BLOCK_MARGIN_MAX, BLOCK_MARGIN_SNAP, blockMarginValue, snapToScale } from "./spacing";

/**
 * Whether the block at `pos` can carry a leading margin — shared by the canvas
 * handle and the BlockSettings "Spacing" control so both agree. Row cells are
 * laid out by shuffle's grid (no margin handle), and a first child's leading
 * edge is owned by the section/container padding before it, so both are
 * excluded. A container child IS eligible on either axis: vertical stacks use
 * a top margin, horizontal stacks a left margin (see `isHorizontalStackChild`).
 */
export function canHaveTopMargin(state: EditorState, pos: number | null): boolean {
  if (pos == null) return false;
  if (!state.doc.nodeAt(pos)) return false;
  const $pos = state.doc.resolve(pos);
  return $pos.parent.type.name !== "row" && $pos.index() !== 0;
}

/**
 * Whether the block at `pos` sits in a HORIZONTAL container — its leading
 * margin then lives on the left (the stack's main axis), not the top. Lets the
 * canvas handle and the panel control orient themselves to the stack's axis.
 */
export function isHorizontalStackChild(state: EditorState, pos: number | null): boolean {
  if (pos == null || !state.doc.nodeAt(pos)) return false;
  const parent = state.doc.resolve(pos).parent;
  return parent.type.name === "container" && parent.attrs["axis"] === "horizontal";
}

export function BlockMarginHandle() {
  const state = useEditorState();
  const pos = getActiveBlockPos(state);
  const shuffleDragging = shufflePluginKey.getState(state)?.activeNodePos != null;

  const target = useMemo(() => {
    if (pos == null || !canHaveTopMargin(state, pos)) return null;
    return {
      pos,
      marginValue: blockMarginValue(state.doc.nodeAt(pos)!.attrs),
      horizontal: isHorizontalStackChild(state, pos),
    };
  }, [state, pos]);

  // Hide during a shuffle drag/resize (the ring stays via blockHighlight) —
  // same gating as the resize handles + settings toolbar.
  if (!target || shuffleDragging || isBlockResizing(state)) return null;
  return (
    <MarginBand
      key={target.pos}
      pos={target.pos}
      marginValue={target.marginValue}
      horizontal={target.horizontal}
    />
  );
}

function MarginBand({
  pos,
  marginValue,
  horizontal,
}: {
  pos: number;
  marginValue: number | null;
  /** Horizontal stack child: the leading margin is on the LEFT, so the band
   *  parks in the left gutter and scrubs along X instead of Y. */
  horizontal: boolean;
}) {
  const hasExplicit = marginValue != null;
  const bandRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [dragging, setDragging] = useState(false);

  // Park the fixed band over the block's COMPUTED leading-margin region — so
  // Auto shows the real default rhythm (e.g. a container child's 16px) rather
  // than a collapsed 0, and an explicit value shows exactly. The block's
  // border-box edge is past its margin, so the region is [edge - margin, edge]
  // on the stack's main axis (top for vertical, left for horizontal).
  const reposition = useCallback(() => {
    const view = viewRef.current;
    const band = bandRef.current;
    if (!view || !band) return;
    const dom = view.nodeDOM(pos);
    if (!(dom instanceof HTMLElement)) {
      band.style.display = "none";
      return;
    }
    const cs = getComputedStyle(dom);
    const rect = dom.getBoundingClientRect();
    band.style.display = "";
    if (horizontal) {
      const ml = parseFloat(cs.marginLeft) || 0;
      band.style.left = `${rect.left - ml}px`;
      band.style.width = `${ml}px`;
      band.style.top = `${rect.top}px`;
      band.style.height = `${rect.height}px`;
      // Mirror the 1px nudge on the inline axis so the dash reads as the edge.
      band.style.paddingRight = ml > 1 ? "1px" : "0px";
      band.style.paddingBottom = "0px";
    } else {
      const mt = parseFloat(cs.marginTop) || 0;
      band.style.left = `${rect.left}px`;
      band.style.width = `${rect.width}px`;
      band.style.top = `${rect.top - mt}px`;
      band.style.height = `${mt}px`;
      // pagy's trick: 1px bottom padding lifts the flex-centered dash just off
      // the block's top edge so the hash reads as the boundary, not on the text.
      band.style.paddingBottom = mt > 1 ? "1px" : "0px";
      band.style.paddingRight = "0px";
    }
  }, [pos, marginValue, horizontal]);

  // Re-measure after every editor render (doc edits, decoration changes) —
  // no deps, like BlockSettings' reference resolve.
  useEditorEffect((view) => {
    viewRef.current = view;
    reposition();
  });

  useEffect(() => {
    reposition();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [reposition]);

  const onHandleDown = useEditorEventCallback((view, e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    // Start from the explicit value, else the computed default (Auto) — so a
    // drag from Auto begins at the real rhythm, like pagy.
    const explicit = blockMarginValue(view.state.doc.nodeAt(pos)?.attrs);
    const dom = view.nodeDOM(pos);
    const start =
      explicit ??
      (dom instanceof HTMLElement
        ? parseFloat(getComputedStyle(dom)[horizontal ? "marginLeft" : "marginTop"]) || 0
        : 0);
    // Scrub along the stack's main axis: DOWN grows a vertical stack's top
    // margin, RIGHT grows a horizontal stack's left margin (pagy's 2× feel).
    const origin = horizontal ? e.pageX : e.pageY;
    let current = start;
    setDragging(true);
    document.body.style.userSelect = "none";

    const onMove = (ev: PointerEvent) => {
      const moved = (horizontal ? ev.pageX : ev.pageY) - origin;
      const next = snapToScale(
        BLOCK_MARGIN_SNAP,
        Math.min(Math.max(start + 2 * moved, 0), BLOCK_MARGIN_MAX),
      );
      if (next === current) return;
      current = next;
      view.dispatch(view.state.tr.setNodeAttribute(pos, "margin", next));
    };
    const onUp = () => {
      document.body.style.userSelect = "";
      setDragging(false);
      document.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("pointerup", onUp, true);
    };
    document.addEventListener("pointermove", onMove, true);
    document.addEventListener("pointerup", onUp, true);
    e.preventDefault();
    e.stopPropagation();
  });

  // Reset returns to Auto (null), NOT explicit 0 — 0 means "collapse", Auto
  // means "no explicit margin".
  const reset = useEditorEventCallback((view) => {
    view.dispatch(view.state.tr.setNodeAttribute(pos, "margin", null));
  });

  // Handle + value are direct children (pagy structure): the band flex-centers
  // the dash, `.pb-space-handle:hover + .pb-space-value` reveals the pill. The
  // pill reads "Auto" when unset, else the px + a reset. `onPointerDown
  // preventDefault` on the band keeps the press from dropping the selection.
  const edge = horizontal ? "left" : "top";
  return createPortal(
    <div
      ref={bandRef}
      className={`pb-space pb-space--margin${horizontal ? " -x" : ""}${dragging ? " -dragging" : ""}`}
      style={{ position: "fixed" }}
      onPointerDown={(e) => e.preventDefault()}
    >
      <button
        type="button"
        className="pb-space-handle"
        aria-label={`Drag to change ${edge} margin`}
        onPointerDown={onHandleDown}
      />
      <div className="pb-space-value">
        {hasExplicit ? marginValue : "Auto"}
        {hasExplicit && (
          <button
            type="button"
            className="pb-space-reset"
            aria-label={`Reset ${edge} margin`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={reset}
          >
            <ArrowCounterClockwise size={12} weight="bold" />
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
