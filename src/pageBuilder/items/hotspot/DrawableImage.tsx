/**
 * Hotspot builder — the drawable image surface. The author picks a tool (Box /
 * Point / Select) and marks regions directly on the image:
 *   • Box   — drag to draw a rectangle.
 *   • Point — click to drop a point.
 *   • Select — click a region to select it; drag its body to move, drag the SE
 *     handle (rects) to resize, toggle Correct/Distractor, or delete it.
 *
 * Geometry is committed to the node (via `onChange`) ONLY at the end of a gesture
 * (pointerup), never mid-drag — so a drag is pure local React state and doesn't
 * churn ProseMirror (which would re-render the node view mid-gesture). All coords
 * are normalized 0..1 against the image box (see `regions.ts`).
 *
 * The surface carries `.pp-hotspot-draw`, which the shuffle config ignores, so
 * drawing on the image doesn't start a block drag.
 */

"use client";

import { Circle, Cursor, Square, Trash } from "@phosphor-icons/react";
import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import {
  clamp01,
  newRegion,
  rectFromPoints,
  regionStyle,
  type HotspotRegion,
} from "./regions";

type Tool = "select" | "rect" | "point";
const MIN = 0.02; // smallest meaningful rect side (and a stray-click guard)

export function DrawableImage({
  src,
  alt,
  regions,
  mode,
  onChange,
}: {
  src: string;
  alt: string;
  regions: HotspotRegion[];
  /** In "find" mode every region is a target, so the Correct/Distractor toggle
   *  is hidden — distractors only mean something when regions are visible. */
  mode: "select" | "find";
  onChange: (next: HotspotRegion[]) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<Tool>("rect");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // In-progress rect being drawn (rect tool).
  const [draft, setDraft] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  // In-progress move/resize of an existing region (select tool).
  const dragRef = useRef<{
    id: string;
    mode: "move" | "resize";
    px: number;
    py: number;
    orig: HotspotRegion;
  } | null>(null);
  const [dragGeom, setDragGeom] = useState<HotspotRegion | null>(null);

  /** Best-effort pointer capture — keeps move/up firing if the pointer leaves
   *  the surface mid-drag. Throws for a non-active pointer (e.g. a synthetic
   *  test event), so it must never block the gesture it precedes. */
  const capture = (e: ReactPointerEvent) => {
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      /* no active pointer — drawing still works while the cursor stays over it */
    }
  };

  const norm = (e: ReactPointerEvent) => {
    const el = wrapRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    return {
      x: clamp01((e.clientX - r.left) / r.width),
      y: clamp01((e.clientY - r.top) / r.height),
    };
  };

  // ── Surface gestures (draw / deselect) ──────────────────────────────
  const onSurfaceDown = (e: ReactPointerEvent) => {
    if (!src) return;
    const p = norm(e);
    if (tool === "point") {
      const region = newRegion({ shape: "point", x: p.x, y: p.y });
      onChange([...regions, region]);
      setSelectedId(region.id);
      setTool("select");
      return;
    }
    if (tool === "rect") {
      startRef.current = p;
      setDraft({ x: p.x, y: p.y, w: 0, h: 0 });
      setSelectedId(null);
      capture(e); // best-effort: keep tracking if the pointer leaves the image
      return;
    }
    setSelectedId(null); // select tool, empty space → deselect
  };

  const onSurfaceMove = (e: ReactPointerEvent) => {
    const p = norm(e);
    if (draft && startRef.current) {
      setDraft(rectFromPoints(startRef.current.x, startRef.current.y, p.x, p.y));
      return;
    }
    if (dragRef.current) {
      const d = dragRef.current;
      const dx = p.x - d.px;
      const dy = p.y - d.py;
      if (d.mode === "move") {
        const maxX = d.orig.shape === "rect" ? 1 - d.orig.w : 1;
        const maxY = d.orig.shape === "rect" ? 1 - d.orig.h : 1;
        setDragGeom({
          ...d.orig,
          x: Math.min(Math.max(0, d.orig.x + dx), maxX),
          y: Math.min(Math.max(0, d.orig.y + dy), maxY),
        });
      } else {
        setDragGeom({
          ...d.orig,
          w: clamp01(Math.max(MIN, d.orig.w + dx)),
          h: clamp01(Math.max(MIN, d.orig.h + dy)),
        });
      }
    }
  };

  const onSurfaceUp = () => {
    if (draft) {
      if (draft.w >= MIN && draft.h >= MIN) {
        const region = newRegion({ shape: "rect", ...draft });
        onChange([...regions, region]);
        setSelectedId(region.id);
      }
      setDraft(null);
      startRef.current = null;
      setTool("select");
      return;
    }
    if (dragRef.current && dragGeom) {
      const id = dragRef.current.id;
      const g = dragGeom;
      onChange(regions.map((r) => (r.id === id ? g : r)));
    }
    dragRef.current = null;
    setDragGeom(null);
  };

  // ── Region gestures (move / resize) ─────────────────────────────────
  const startRegionDrag = (
    e: ReactPointerEvent,
    region: HotspotRegion,
    mode: "move" | "resize",
  ) => {
    if (tool !== "select") return; // draw tools: let the surface draw through
    e.stopPropagation();
    const p = norm(e);
    dragRef.current = { id: region.id, mode, px: p.x, py: p.y, orig: region };
    setSelectedId(region.id);
    setDragGeom(region);
    capture(e);
  };

  const setCorrect = (id: string, correct: boolean) =>
    onChange(regions.map((r) => (r.id === id ? { ...r, correct } : r)));
  const remove = (id: string) => {
    onChange(regions.filter((r) => r.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const toolBtn = (t: Tool, label: string, Icon: typeof Square) => (
    <button
      type="button"
      className="pp-hotspot-tool"
      data-active={tool === t || undefined}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        setTool(t);
        if (t !== "select") setSelectedId(null);
      }}
      title={label}
      aria-label={label}
      aria-pressed={tool === t}
    >
      <Icon size={15} weight="bold" />
    </button>
  );

  return (
    <div className="pp-hotspot-builder" contentEditable={false}>
      <div className="pp-hotspot-tools">
        {toolBtn("rect", "Draw box", Square)}
        {toolBtn("point", "Drop point", Circle)}
        {toolBtn("select", "Select / move", Cursor)}
        <span className="pp-hotspot-tools-hint">
          {tool === "select"
            ? "Click a region to move, resize, or delete it"
            : tool === "rect"
              ? "Drag on the image to draw a box"
              : "Click on the image to drop a point"}
        </span>
      </div>

      <div ref={wrapRef} className="pp-hotspot-image" data-tool={tool}>
        {src ? (
          <img src={src} alt={alt} draggable={false} />
        ) : (
          <div className="pp-hotspot-empty">Add an image in settings, then draw regions</div>
        )}

        {/* Pointer surface — captures draws + empty-space deselects. Regions are
            pointer-events:none in draw tools (CSS), so drags pass through to here. */}
        <div
          className="pp-hotspot-draw"
          onPointerDown={onSurfaceDown}
          onPointerMove={onSurfaceMove}
          onPointerUp={onSurfaceUp}
          onPointerCancel={onSurfaceUp}
        />

        {regions.map((r) => {
          const g = dragGeom && dragGeom.id === r.id ? dragGeom : r;
          const sel = selectedId === r.id;
          return (
            <div
              key={r.id}
              className="pp-hotspot-region pp-hotspot-region--edit"
              data-shape={g.shape}
              data-correct={g.correct || undefined}
              data-selected={sel || undefined}
              style={regionStyle(g)}
              onPointerDown={(e) => startRegionDrag(e, g, "move")}
            >
              {sel && (
                <div className="pp-hotspot-region-ui" onPointerDown={(e) => e.stopPropagation()}>
                  {mode === "select" && (
                    <button
                      type="button"
                      className="pp-hotspot-region-correct"
                      data-correct={g.correct || undefined}
                      onClick={() => setCorrect(g.id, !g.correct)}
                      title={g.correct ? "Correct (click to make distractor)" : "Distractor (click to make correct)"}
                    >
                      {g.correct ? "✓ Correct" : "✗ Distractor"}
                    </button>
                  )}
                  <button
                    type="button"
                    className="pp-hotspot-region-del"
                    onClick={() => remove(g.id)}
                    title="Delete region"
                    aria-label="Delete region"
                  >
                    <Trash size={12} weight="bold" />
                  </button>
                </div>
              )}
              {sel && g.shape === "rect" && (
                <span
                  className="pp-hotspot-resize"
                  onPointerDown={(e) => startRegionDrag(e, g, "resize")}
                  aria-hidden
                />
              )}
            </div>
          );
        })}

        {draft && (
          <div
            className="pp-hotspot-region pp-hotspot-region--draft"
            data-shape="rect"
            style={regionStyle({ ...newRegion({}), shape: "rect", ...draft })}
          />
        )}
      </div>
    </div>
  );
}
