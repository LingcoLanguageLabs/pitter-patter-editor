/**
 * Hotspot — completer (student-facing). Two modes off the typed def:
 *   • "select" — the author's regions are visible, clickable overlays; the
 *     student toggles the ones they think are correct (the image cousin of Mark
 *     Tokens). Response = clicked region ids.
 *   • "find"   — regions are HIDDEN; the student clicks the image to place
 *     markers on the target(s). Response = click points. On grade the targets
 *     are revealed (found / missed) and each marker colored hit / astray.
 *
 * Both persist to the grading store (keyed by `itemId`), show feedback on an
 * official Check, and clear it on edit. Prompt renders via the shared walker.
 */

import { useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";

import { ItemFeedback } from "../shared/Feedback";
import { useRenderBlocks } from "../shared/blockRenderer";
import { useItemGrading } from "../shared/grading";
import type { CompleterProps } from "../types";
import {
  gradeHotspot,
  isFindPoints,
  markerHit,
  regionFound,
  regionState,
  type FindPoint,
} from "./grade";
import { clamp01, regionStyle } from "./regions";
import type { HotspotDef } from "./serialize";

export function HotspotCompleter({ def }: CompleterProps<HotspotDef>) {
  return def.mode === "find" ? (
    <FindHotspot def={def} />
  ) : (
    <SelectHotspot def={def} />
  );
}

function HotspotPrompt({ def }: { def: HotspotDef }) {
  const renderBlocks = useRenderBlocks();
  if (def.prompt.length === 0) return null;
  return <div className="pp-hotspot-completer-prompt">{renderBlocks(def.prompt)}</div>;
}

// ── select mode: tap the visible correct regions ─────────────────────
function SelectHotspot({ def }: { def: HotspotDef }) {
  const { itemId, src, alt, regions, feedback } = def;
  const { graded, initialResponse, persist, reset } = useItemGrading(itemId);
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set((initialResponse as string[]) ?? []),
  );
  const grade = useMemo(
    () => (graded ? gradeHotspot(def, [...selected]) : null),
    [graded, def, selected],
  );
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      persist([...next]);
      return next;
    });

  return (
    <div className="pp-hotspot-completer">
      <HotspotPrompt def={def} />
      <div className="pp-hotspot-image" data-graded={graded || undefined}>
        {src ? (
          <img src={src} alt={alt} draggable={false} />
        ) : (
          <div className="pp-hotspot-empty">No image</div>
        )}
        {regions.map((r) => (
          <button
            key={r.id}
            type="button"
            className="pp-hotspot-region"
            data-shape={r.shape}
            data-selected={selected.has(r.id) || undefined}
            data-state={grade ? regionState(r, selected) : undefined}
            style={regionStyle(r)}
            aria-pressed={selected.has(r.id)}
            aria-label="Hotspot region"
            onClick={() => toggle(r.id)}
          />
        ))}
      </div>
      {grade && (
        <ItemFeedback
          status={grade.status}
          feedback={feedback}
          explanation={def.explanation}
          onTryAgain={reset}
        />
      )}
    </div>
  );
}

// ── find mode: click the image to locate hidden targets ──────────────
const MARKER_NEAR = 0.03; // click within this of an existing marker removes it

function FindHotspot({ def }: { def: HotspotDef }) {
  const { itemId, src, alt, regions, feedback } = def;
  const { graded, initialResponse, persist, reset } = useItemGrading(itemId);
  const [points, setPoints] = useState<FindPoint[]>(() =>
    isFindPoints(initialResponse) ? initialResponse : [],
  );
  const wrapRef = useRef<HTMLDivElement>(null);
  const grade = useMemo(
    () => (graded ? gradeHotspot(def, points) : null),
    [graded, def, points],
  );

  // A click adds a marker; clicking near an existing one removes it.
  const onClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    const el = wrapRef.current;
    if (!el || !src) return;
    const r = el.getBoundingClientRect();
    const x = clamp01((e.clientX - r.left) / r.width);
    const y = clamp01((e.clientY - r.top) / r.height);
    setPoints((prev) => {
      const near = prev.findIndex(
        (p) => Math.abs(p.x - x) < MARKER_NEAR && Math.abs(p.y - y) < MARKER_NEAR,
      );
      const next = near >= 0 ? prev.filter((_, i) => i !== near) : [...prev, { x, y }];
      persist(next);
      return next;
    });
  };

  return (
    <div className="pp-hotspot-completer">
      <HotspotPrompt def={def} />
      <div
        ref={wrapRef}
        className="pp-hotspot-image pp-hotspot-image--find"
        data-graded={graded || undefined}
        onClick={onClick}
      >
        {src ? (
          <img src={src} alt={alt} draggable={false} />
        ) : (
          <div className="pp-hotspot-empty">No image</div>
        )}
        {/* the student's placed markers */}
        {points.map((p, i) => (
          <span
            key={i}
            className="pp-hotspot-marker"
            data-state={grade ? (markerHit(def, p) ? "hit" : "miss") : undefined}
            style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
          />
        ))}
        {/* on grade, reveal the targets: found (solid) vs missed (dashed) */}
        {grade &&
          regions
            .filter((r) => r.correct)
            .map((r) => (
              <div
                key={r.id}
                className="pp-hotspot-region pp-hotspot-region--reveal"
                data-shape={r.shape}
                data-state={regionFound(r, points) ? "correct" : "missed"}
                style={regionStyle(r)}
              />
            ))}
      </div>
      {grade && (
        <ItemFeedback
          status={grade.status}
          feedback={feedback}
          explanation={def.explanation}
          onTryAgain={reset}
        />
      )}
    </div>
  );
}
