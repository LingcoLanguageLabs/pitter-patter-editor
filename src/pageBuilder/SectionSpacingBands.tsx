/**
 * Section vertical-padding drag bands. Two hatched bands (top + bottom) overlay
 * the section's padding region; dragging either resizes the section's SINGLE
 * symmetric `padding` value (top = bottom).
 *
 * Both handles share the SAME drag sign (pagy's behavior): you drag DOWN to grow
 * the padding from either notch. The top notch grows by pushing its edge down
 * into the content; the bottom notch grows by pulling its edge down/outward — so
 * "drag the edge down → bigger" reads consistently on both, top and bottom.
 *
 * Rendered inside `SectionChromeWidget`, so it lives in the section chrome's
 * widget decoration — opaque to PM `posAtCoords`, i.e. invisible to shuffle's
 * drop math. Vertical padding is orthogonal to shuffle's grid, so there's
 * nothing to coordinate; the drag just writes one attr.
 */

"use client";

import { useEditorEventCallback, useEditorState } from "@handlewithcare/react-prosemirror";
import { type PointerEvent as ReactPointerEvent, useState } from "react";

import { findEnclosingOfType } from "./sectionUtils";
import {
  SECTION_PADDING_DEFAULT,
  SECTION_PADDING_MAX,
  SECTION_PADDING_SNAP,
  sectionPaddingPx,
  snapToScale,
} from "./spacing";

type Side = "top" | "bottom";

// Section, header AND footer all store a symmetric px `padding` dragged the same
// way, so these bands serve all three (mounted by the section chrome and, for the
// header/footer bars, by the header/footer chrome).
const PADDING_OWNERS = ["section", "header", "footer"] as const;

export function SectionSpacingBands({ getPos }: { getPos: () => number }) {
  const editorState = useEditorState();
  const [dragging, setDragging] = useState<Side | false>(false);

  const info = findEnclosingOfType(editorState, getPos(), PADDING_OWNERS);
  const padPx = info ? sectionPaddingPx(info.node.attrs) : SECTION_PADDING_DEFAULT;

  // Drag a band: read the live padding at press, then on each move write the
  // snapped px (absolute from the start, so the value never drifts). Captured
  // document listeners follow the pointer past the band; `stopPropagation`
  // keeps the press off the editor's mousedown selection handler.
  const onHandleDown = useEditorEventCallback(
    (view, side: Side, e: ReactPointerEvent) => {
      if (e.button !== 0) return;
      const sec = findEnclosingOfType(view.state, getPos(), PADDING_OWNERS);
      if (!sec) return;
      const start = sectionPaddingPx(sec.node.attrs);
      const originY = e.pageY;
      let current = start;
      setDragging(side);
      document.body.style.userSelect = "none";

      const onMove = (ev: PointerEvent) => {
        // Both notches grow on drag DOWN (pagy's signs): top moves 2× as fast,
        // bottom 2/3× — but SAME direction, so "drag the edge down → grow".
        const delta = (ev.pageY - originY) * (side === "top" ? 2 : 2 / 3);
        const next = snapToScale(
          SECTION_PADDING_SNAP,
          Math.min(Math.max(start + delta, 0), SECTION_PADDING_MAX),
        );
        if (next === current) return;
        current = next;
        const at = findEnclosingOfType(view.state, getPos(), PADDING_OWNERS);
        if (at) view.dispatch(view.state.tr.setNodeAttribute(at.pos, "padding", next));
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
    },
  );

  if (!info) return null;

  // Handle + value are direct children of the band (pagy structure): the band
  // flex-centers the handle, and `.pb-space-handle:hover + .pb-space-value`
  // reveals the pill. No reset on the section pill — pagy only resets margins.
  return (
    <>
      {(["top", "bottom"] as const).map((side) => {
        const isDragged = dragging === side;
        // Padding is symmetric (one value drives top + bottom), so a drag on
        // either band resizes both. `-mirror` lights the OTHER band's hatch +
        // handle while dragging (no pill — the dragged band owns the value).
        const isMirror = dragging !== false && !isDragged;
        return (
          <div
            key={side}
            className={`pb-space pb-space--${side}${isDragged ? " -dragging" : ""}${isMirror ? " -mirror" : ""}`}
            style={{ height: padPx }}
          >
            <button
              type="button"
              className="pb-space-handle -section"
              aria-label={`Drag to change section padding (${padPx}px)`}
              onPointerDown={(e) => onHandleDown(side, e)}
            />
            <div className="pb-space-value">{padPx}</div>
          </div>
        );
      })}
    </>
  );
}
