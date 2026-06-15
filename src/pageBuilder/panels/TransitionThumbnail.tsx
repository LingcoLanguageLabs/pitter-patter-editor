/**
 * Self-generated SVG thumbnails for the transition gallery — the PowerPoint
 * two-slide motif (a light "slide" with a glyph hinting at the effect), drawn
 * here rather than hotlinked, so the set is consistent and self-contained.
 *
 * Each catalog id maps to a `kind` (a small set of reusable glyph primitives);
 * the `variant` ("from-left", "circle-out"…) rotates/flips directional glyphs.
 * Effects without a bespoke glyph use the generic "spark" so the gallery is
 * complete. All glyphs use `currentColor`, so the card controls the tint.
 */

type Kind =
  | "none"
  | "fade"
  | "arrow"
  | "wipe"
  | "split"
  | "reveal"
  | "cut"
  | "bars"
  | "grid"
  | "shape"
  | "flash"
  | "flip3d"
  | "cube"
  | "clock"
  | "hex"
  | "curl"
  | "curtains"
  | "spark";

const KIND: Record<string, Kind> = {
  none: "none",
  morph: "fade",
  cut: "cut",
  push: "arrow",
  cover: "arrow",
  reveal: "reveal",
  flash: "flash",
  flip: "flip3d",
  cube: "cube",
  gallery: "cube",
  clock: "clock",
  // Curtains-backed effects carry the canonical labels (Fade/Wipe/Doors/…).
  "curtains-fade": "fade",
  "curtains-wipe": "wipe",
  "curtains-doors": "split",
  "curtains-iris": "shape",
  "curtains-blinds": "bars",
  "curtains-pixels": "grid",
};

/** Rotation (deg) to point a "from-right" arrow glyph toward the variant. */
function arrowRotation(variant: string): number {
  switch (variant) {
    case "from-left":
      return 180;
    case "from-top":
      return 90;
    case "from-bottom":
      return -90;
    default:
      return 0; // from-right: arrow points left (incoming from the right)
  }
}

export function TransitionThumbnail({
  id,
  variant = "",
}: {
  id: string;
  variant?: string;
}) {
  const kind = KIND[id] ?? "spark";
  return (
    <svg
      className="pb-trans-thumb-svg"
      viewBox="0 0 80 48"
      role="img"
      aria-hidden
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Slide frame */}
      <rect x="0.5" y="0.5" width="79" height="47" rx="3" className="pb-trans-thumb-frame" />
      <Glyph kind={kind} variant={variant} />
    </svg>
  );
}

function Glyph({ kind, variant }: { kind: Kind; variant: string }) {
  switch (kind) {
    case "none":
      return <text x="40" y="29" className="pb-trans-thumb-text">∅</text>;

    case "fade":
      return (
        <>
          <rect x="10" y="10" width="40" height="28" rx="2" className="pb-trans-thumb-fill" opacity="0.9" />
          <rect x="30" y="10" width="40" height="28" rx="2" className="pb-trans-thumb-fill" opacity="0.4" />
        </>
      );

    case "arrow": {
      const rot = arrowRotation(variant);
      return (
        <g transform={`rotate(${rot} 40 24)`}>
          <rect x="8" y="8" width="64" height="32" rx="2" className="pb-trans-thumb-fill" opacity="0.85" />
          <path d="M50 24 L34 24 M40 18 L34 24 L40 30" className="pb-trans-thumb-stroke" fill="none" />
        </g>
      );
    }

    case "wipe":
      return (
        <>
          <rect x="8" y="8" width="64" height="32" rx="2" className="pb-trans-thumb-fill" opacity="0.35" />
          <rect x="40" y="8" width="32" height="32" className="pb-trans-thumb-fill" opacity="0.9" />
        </>
      );

    case "split":
      return (
        <>
          <rect x="8" y="8" width="28" height="32" rx="2" className="pb-trans-thumb-fill" opacity="0.9" />
          <rect x="44" y="8" width="28" height="32" rx="2" className="pb-trans-thumb-fill" opacity="0.9" />
        </>
      );

    case "reveal":
      return (
        <>
          <rect x="8" y="8" width="64" height="32" rx="2" className="pb-trans-thumb-fill" opacity="0.4" />
          <rect x="8" y="8" width="40" height="32" rx="2" className="pb-trans-thumb-fill" opacity="0.9" />
        </>
      );

    case "cut":
      return (
        <>
          <rect x="8" y="8" width="30" height="32" rx="2" className="pb-trans-thumb-fill" opacity="0.9" />
          <rect x="42" y="8" width="30" height="32" rx="2" className="pb-trans-thumb-fill" opacity="0.55" />
        </>
      );

    case "bars": {
      const vertical = variant === "columns" || variant === "vertical";
      const bars = [0, 1, 2, 3, 4, 5];
      return (
        <g>
          {bars.map((i) =>
            vertical ? (
              <rect key={i} x={8 + i * 11} y="8" width="6" height="32" className="pb-trans-thumb-fill" opacity={i % 2 ? 0.4 : 0.9} />
            ) : (
              <rect key={i} x="8" y={8 + i * 5.6} width="64" height="3.2" className="pb-trans-thumb-fill" opacity={i % 2 ? 0.4 : 0.9} />
            ),
          )}
        </g>
      );
    }

    case "grid": {
      const cells = [];
      for (let r = 0; r < 4; r++)
        for (let c = 0; c < 7; c++)
          if ((r + c) % 2 === 0)
            cells.push(<rect key={`${r}-${c}`} x={8 + c * 9} y={8 + r * 8} width="9" height="8" className="pb-trans-thumb-fill" opacity="0.85" />);
      return <g>{cells}</g>;
    }

    case "shape": {
      const diamond = variant.startsWith("diamond");
      return (
        <>
          <rect x="8" y="8" width="64" height="32" rx="2" className="pb-trans-thumb-fill" opacity="0.35" />
          {diamond ? (
            <path d="M40 12 L54 24 L40 36 L26 24 Z" className="pb-trans-thumb-fill" opacity="0.95" />
          ) : (
            <circle cx="40" cy="24" r="13" className="pb-trans-thumb-fill" opacity="0.95" />
          )}
        </>
      );
    }

    case "flash":
      return (
        <g className="pb-trans-thumb-stroke" fill="none">
          <circle cx="40" cy="24" r="8" className="pb-trans-thumb-fill" opacity="0.95" />
          <path d="M40 6 V14 M40 34 V42 M22 24 H30 M50 24 H58 M27 11 L32 16 M53 37 L48 32 M53 11 L48 16 M27 37 L32 32" />
        </g>
      );

    case "flip3d":
      return (
        <g>
          <path d="M40 6 L70 12 V36 L40 42 Z" className="pb-trans-thumb-fill" opacity="0.9" />
          <path d="M40 6 L10 12 V36 L40 42 Z" className="pb-trans-thumb-fill" opacity="0.4" />
        </g>
      );

    case "cube":
      return (
        <g>
          <path d="M30 10 L66 16 V34 L30 40 Z" className="pb-trans-thumb-fill" opacity="0.9" />
          <path d="M30 10 L14 16 V32 L30 40 Z" className="pb-trans-thumb-fill" opacity="0.5" />
        </g>
      );

    case "clock":
      return (
        <g>
          <circle cx="40" cy="24" r="14" className="pb-trans-thumb-fill" opacity="0.85" />
          <path d="M40 24 V13 M40 24 L49 28" className="pb-trans-thumb-stroke" fill="none" />
        </g>
      );

    case "hex": {
      const hex = (cx: number, cy: number, op: number) =>
        `M${cx} ${cy - 6} L${cx + 5} ${cy - 3} L${cx + 5} ${cy + 3} L${cx} ${cy + 6} L${cx - 5} ${cy + 3} L${cx - 5} ${cy - 3} Z`;
      const centers: [number, number][] = [
        [26, 18], [40, 18], [54, 18], [33, 30], [47, 30],
      ];
      return (
        <g>
          {centers.map(([cx, cy], i) => (
            <path key={i} d={hex(cx, cy, 1)} className="pb-trans-thumb-fill" opacity={0.6 + (i % 2) * 0.3} />
          ))}
        </g>
      );
    }

    case "curl":
      return (
        <>
          <rect x="8" y="8" width="64" height="32" rx="2" className="pb-trans-thumb-fill" opacity="0.85" />
          <path d="M72 8 L52 8 Q72 18 72 40 Z" className="pb-trans-thumb-fill" opacity="0.45" />
        </>
      );

    case "curtains":
      return (
        <g>
          {[12, 24, 36, 48, 60].map((x, i) => (
            <path key={i} d={`M${x} 8 Q${x + 4} 24 ${x} 40`} className="pb-trans-thumb-stroke" fill="none" opacity={0.5 + (i % 2) * 0.4} />
          ))}
        </g>
      );

    case "spark":
    default:
      return (
        <g>
          <rect x="8" y="8" width="64" height="32" rx="2" className="pb-trans-thumb-fill" opacity="0.55" />
          <path d="M40 14 L43 22 L51 24 L43 26 L40 34 L37 26 L29 24 L37 22 Z" className="pb-trans-thumb-fill" opacity="0.95" />
        </g>
      );
  }
}
