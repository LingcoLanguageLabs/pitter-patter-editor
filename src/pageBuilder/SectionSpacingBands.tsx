/**
 * Section vertical-padding drag bands. Two hatched bands (top + bottom) overlay
 * the section's padding region; dragging either resizes the section's SINGLE
 * symmetric `padding` value (top = bottom).
 *
 * The two handles MIRROR each other — each notch starts at its own edge and you
 * drag it toward the content to grow the padding: the top notch (at the top)
 * drags DOWN, the bottom notch (at the bottom) drags UP. So the bottom inverts
 * the drag sign — this is a deliberate divergence from pagy, whose bottom uses
 * the same sign as the top ("drag up to shrink"), which reads backwards.
 *
 * Rendered inside `SectionChromeWidget`, so it lives in the section chrome's
 * widget decoration — opaque to PM `posAtCoords`, i.e. invisible to shuffle's
 * drop math. Vertical padding is orthogonal to shuffle's grid, so there's
 * nothing to coordinate; the drag just writes one attr.
 */

"use client";

import { useEditorEventCallback, useEditorState } from "@handlewithcare/react-prosemirror";
import { type PointerEvent as ReactPointerEvent, useState } from "react";

import { findEnclosingSection } from "./sectionUtils";
import {
  SECTION_PADDING_DEFAULT,
  SECTION_PADDING_MAX,
  SECTION_PADDING_SNAP,
  sectionPaddingPx,
  snapToScale,
} from "./spacing";

type Side = "top" | "bottom";

export function SectionSpacingBands({ getPos }: { getPos: () => number }) {
  const editorState = useEditorState();
  const [dragging, setDragging] = useState<Side | false>(false);

  const info = findEnclosingSection(editorState, getPos());
  const padPx = info ? sectionPaddingPx(info.node.attrs) : SECTION_PADDING_DEFAULT;

  // Drag a band: read the live padding at press, then on each move write the
  // snapped px (absolute from the start, so the value never drifts). Captured
  // document listeners follow the pointer past the band; `stopPropagation`
  // keeps the press off the editor's mousedown selection handler.
  const onHandleDown = useEditorEventCallback(
    (view, side: Side, e: ReactPointerEvent) => {
      if (e.button !== 0) return;
      const sec = findEnclosingSection(view.state, getPos());
      if (!sec) return;
      const start = sectionPaddingPx(sec.node.attrs);
      const originY = e.pageY;
      let current = start;
      setDragging(side);
      document.body.style.userSelect = "none";

      const onMove = (ev: PointerEvent) => {
        // Top: drag DOWN to grow (+2×). Bottom: mirror — drag UP to grow, so
        // the sign is negated (drag DOWN shrinks). Magnitudes are pagy's.
        const delta = (ev.pageY - originY) * (side === "top" ? 2 : -2 / 3);
        const next = snapToScale(
          SECTION_PADDING_SNAP,
          Math.min(Math.max(start + delta, 0), SECTION_PADDING_MAX),
        );
        if (next === current) return;
        current = next;
        const at = findEnclosingSection(view.state, getPos());
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
      {(["top", "bottom"] as const).map((side) => (
        <div
          key={side}
          className={`pb-space pb-space--${side}${dragging === side ? " -dragging" : ""}`}
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
      ))}
    </>
  );
}
