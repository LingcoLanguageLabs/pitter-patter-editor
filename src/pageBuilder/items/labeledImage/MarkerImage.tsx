/**
 * Labeled image builder — the markable image surface. The author clicks empty
 * space to drop a point marker, and drags an existing marker to reposition it.
 * Each marker's title/description is edited in the settings panel (the markers
 * are numbered here to match the settings list).
 *
 * Geometry commits to the node (via `onChange`) at the END of a gesture, never
 * mid-drag — a drag is pure local React state so it doesn't churn ProseMirror
 * (which would re-render the node view mid-gesture). Coords are normalized 0..1
 * against the image box. The surface carries `.pp-labeled-draw`, which the
 * shuffle config ignores, so drawing doesn't start a block drag.
 */

"use client";

import { memo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import { clamp01, markerStyle, newMarker, type LabeledMarker } from "./markers";

// Memoized: the parent node view re-renders on its node changes (and a hover
// decoration on the block); without this, that would re-run the map `<img>` +
// markers each time. `onChange` is a stable editor-event callback and `markers`
// is the node attr (new ref only when markers actually change), so memo skips
// re-renders that don't touch the image's inputs.
export const MarkerImage = memo(function MarkerImage({
  src,
  alt,
  markers,
  onChange,
}: {
  src: string;
  alt: string;
  markers: LabeledMarker[];
  onChange: (next: LabeledMarker[]) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; moved: boolean } | null>(null);
  const [dragGeom, setDragGeom] = useState<LabeledMarker | null>(null);

  const norm = (e: ReactPointerEvent) => {
    const el = wrapRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    return {
      x: clamp01((e.clientX - r.left) / r.width),
      y: clamp01((e.clientY - r.top) / r.height),
    };
  };

  // Click on empty image → add a marker (the author titles it in settings).
  const onSurfaceDown = (e: ReactPointerEvent) => {
    if (!src) return;
    e.stopPropagation();
    const p = norm(e);
    onChange([...markers, newMarker({ x: p.x, y: p.y })]);
  };

  const onMarkerDown = (e: ReactPointerEvent, m: LabeledMarker) => {
    e.stopPropagation();
    dragRef.current = { id: m.id, moved: false };
    setDragGeom(m);
  };

  const onMove = (e: ReactPointerEvent) => {
    if (!dragRef.current) return;
    const p = norm(e);
    dragRef.current.moved = true;
    setDragGeom((g) => (g ? { ...g, x: p.x, y: p.y } : g));
  };

  const onUp = () => {
    if (dragRef.current?.moved && dragGeom) {
      const { id } = dragRef.current;
      const g = dragGeom;
      onChange(markers.map((m) => (m.id === id ? { ...m, x: g.x, y: g.y } : m)));
    }
    dragRef.current = null;
    setDragGeom(null);
  };

  return (
    <div
      ref={wrapRef}
      className="pp-labeled-image pp-labeled-image--edit"
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      {src ? (
        <img src={src} alt={alt} draggable={false} />
      ) : (
        <div className="pp-labeled-empty">Add an image in settings →</div>
      )}
      <div className="pp-labeled-draw" onPointerDown={onSurfaceDown} />
      {markers.map((m, i) => {
        const d = dragGeom && dragGeom.id === m.id ? dragGeom : m;
        return (
          <button
            key={m.id}
            type="button"
            className="pp-labeled-marker pp-labeled-marker--edit"
            style={markerStyle(d)}
            onPointerDown={(e) => onMarkerDown(e, m)}
            aria-label={m.label || `Marker ${i + 1}`}
          >
            <span className="pp-labeled-marker-index">{i + 1}</span>
          </button>
        );
      })}
    </div>
  );
});
