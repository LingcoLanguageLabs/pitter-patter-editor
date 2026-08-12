/**
 * ColorPicker — our own picker, replacing the browser-native
 * `<input type="color">` popup. Two modes, switched by a Solid/Gradient tab
 * (gated by `allowGradient`), modelled on PowerPoint's Format-Shape → Fill:
 *
 *   Solid    — saturation/value square + hue/alpha sliders + eyedropper +
 *              HEX/RGB/HSL inputs + quick swatches.
 *   Gradient — a draggable gradient-stops bar (+/− to add/remove), Type
 *              (Linear/Radial/Conic), an angle dial (linear/conic) or a 3×3
 *              position grid (radial), and the SAME colour editor driving the
 *              selected stop.
 *
 * The shared `ColorEditor` edits one HSVA colour; Solid mode points it at the
 * single value, Gradient mode at the selected stop. Internal state is HSVA (not
 * hex) so dragging never loses hue at value/saturation extremes.
 *
 * `value`/`onChange` carry a CSS string: a hex (`#rrggbb`/`#rrggbbaa`) for
 * solids, or a `…-gradient(…)` string for gradients. chroma-js does the colour
 * math; `theme/fill.ts` does the gradient parse/serialise.
 */

import { Eyedropper } from "@phosphor-icons/react";
import * as Popover from "@radix-ui/react-popover";
import chroma from "chroma-js";
import { useEffect, useRef, useState } from "react";

import {
  colorAt,
  defaultGradient,
  fillBaseColor,
  gradientToCss,
  isGradient,
  normalizeColor,
  parseGradient,
  stopsToBarCss,
  type GradientSpec,
  type GradientType,
} from "./theme/fill";

// The EyeDropper API isn't in TS's lib yet; declare the slice we use.
declare global {
  interface Window {
    EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> };
  }
}

const HAS_EYEDROPPER = typeof window !== "undefined" && "EyeDropper" in window;

interface HSVA {
  h: number; // 0–360
  s: number; // 0–1
  v: number; // 0–1
  a: number; // 0–1
}

const clamp = (n: number, lo: number, hi: number) =>
  n < lo ? lo : n > hi ? hi : n;

/** True when chroma can parse the string — guards callers before chroma()
 *  (which throws on partial input like "#" mid-edit). */
export function isValidColor(input: string): boolean {
  return !!input && chroma.valid(input);
}

/** Parse any CSS colour string into HSVA, or null if unparseable. */
function parseColor(input: string): HSVA | null {
  if (!input || !chroma.valid(input)) return null;
  const c = chroma(input);
  const [h, s, v] = c.hsv();
  // chroma reports hue as NaN for greys (no chroma to derive an angle from).
  return { h: Number.isNaN(h) ? 0 : h, s, v, a: c.alpha() };
}

/** HSVA → hex. 8-digit when translucent so alpha survives the round-trip. */
function hsvaToHex({ h, s, v, a }: HSVA): string {
  const c = chroma.hsv(h, s, v).alpha(a);
  return a < 1 ? c.hex("rgba") : c.hex("rgb");
}

const HUE_GRADIENT =
  "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)";

type Format = "hex" | "rgb" | "hsl";
const FORMATS: Format[] = ["hex", "rgb", "hsl"];
type Mode = "solid" | "gradient";

/** A few starter gradients (PowerPoint's "Preset gradients"). */
const PRESETS = [
  "linear-gradient(180deg, #f4eee4 0%, #faf8f4 100%)",
  "linear-gradient(135deg, #6a8dff 0%, #b06aff 100%)",
  "linear-gradient(90deg, #11998e 0%, #38ef7d 100%)",
  "linear-gradient(135deg, #ff6a88 0%, #ff99ac 100%)",
  "radial-gradient(at 80% 0%, #f4eee4 0%, #faf8f4 60%)",
  "conic-gradient(from 180deg at 50% 50%, #5b6ee1 0%, #b06aff 50%, #5b6ee1 100%)",
];

export interface ColorPickerProps {
  value: string;
  onChange: (value: string) => void;
  /** Show the alpha slider + emit 8-digit hex when translucent. Default true. */
  alpha?: boolean;
  /** Offer the Solid/Gradient tab. Default false (solid-only). */
  allowGradient?: boolean;
  /** Quick-pick swatches shown at the bottom (e.g. the live theme palette). */
  swatches?: string[];
  ariaLabel?: string;
  /** Extra class on the trigger swatch button. */
  className?: string;
}

export function ColorPicker({
  value,
  onChange,
  alpha = true,
  allowGradient = false,
  swatches,
  ariaLabel = "Color",
  className,
}: ColorPickerProps) {
  // Mode follows the value, so anything that flips the value's type — the tab,
  // or pasting a solid colour into the gradient CSS box — moves the UI with it.
  const mode: Mode = isGradient(value) ? "gradient" : "solid";

  const switchTo = (next: Mode) => {
    if (next === mode) return;
    if (next === "gradient") {
      onChange(gradientToCss(defaultGradient(isValidColor(value) ? value : "#7f7f7f")));
    } else {
      onChange(fillBaseColor(value));
    }
  };

  const triggerBg = isGradient(value) || isValidColor(value) ? value : "transparent";

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={`pb-cp-trigger${className ? ` ${className}` : ""}`}
          aria-label={ariaLabel}
        >
          <span className="pb-cp-trigger-fill" style={{ background: triggerBg }} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="pb-color-picker"
          side="bottom"
          align="start"
          sideOffset={8}
          collisionPadding={8}
        >
          {allowGradient && (
            <Segmented<Mode>
              ariaLabel="Fill type"
              value={mode}
              options={[
                { value: "solid", label: "Solid" },
                { value: "gradient", label: "Gradient" },
              ]}
              onChange={switchTo}
            />
          )}

          {mode === "gradient" ? (
            <GradientBody
              value={value}
              onChange={onChange}
              alpha={alpha}
              swatches={swatches}
            />
          ) : (
            <SolidBody
              value={isGradient(value) ? fillBaseColor(value) : value}
              onChange={onChange}
              alpha={alpha}
              swatches={swatches}
            />
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/* ── Solid mode ────────────────────────────────────────────────────── */

function SolidBody({
  value,
  onChange,
  alpha,
  swatches,
}: {
  value: string;
  onChange: (hex: string) => void;
  alpha: boolean;
  swatches?: string[];
}) {
  // HSVA is the source of truth while editing. We re-sync from `value` only
  // when it changes from the outside (not our own emit) — otherwise a
  // grey-at-v=0 drag would snap hue back to 0 on every render.
  const [hsva, setHsva] = useState<HSVA>(
    () => parseColor(value) ?? { h: 0, s: 0, v: 0, a: 1 },
  );
  const lastEmit = useRef(value);

  useEffect(() => {
    if (value === lastEmit.current) return;
    const parsed = parseColor(value);
    if (parsed) {
      setHsva(parsed);
      lastEmit.current = value;
    }
  }, [value]);

  const commit = (next: HSVA) => {
    const eff = alpha ? next : { ...next, a: 1 };
    setHsva(eff);
    const hex = hsvaToHex(eff);
    lastEmit.current = hex;
    onChange(hex);
  };

  return <ColorEditor hsva={hsva} alpha={alpha} swatches={swatches} onChange={commit} />;
}

/* ── Gradient mode ─────────────────────────────────────────────────── */

function GradientBody({
  value,
  onChange,
  alpha,
  swatches,
}: {
  value: string;
  onChange: (css: string) => void;
  alpha: boolean;
  swatches?: string[];
}) {
  const [spec, setSpec] = useState<GradientSpec>(
    () => parseGradient(value) ?? defaultGradient("#7f7f7f"),
  );
  const [sel, setSel] = useState(0);
  const lastEmit = useRef(value);

  useEffect(() => {
    if (value === lastEmit.current) return;
    const g = parseGradient(value);
    if (g) {
      setSpec(g);
      lastEmit.current = value;
    }
  }, [value]);

  const emit = (next: GradientSpec) => {
    setSpec(next);
    const css = gradientToCss(next);
    lastEmit.current = css;
    onChange(css);
  };

  const selIdx = Math.min(sel, spec.stops.length - 1);
  const selStop = spec.stops[selIdx]!;
  const selHsva = parseColor(selStop.color) ?? { h: 0, s: 0, v: 0, a: 1 };

  const setStopColor = (hsva: HSVA) => {
    const stops = spec.stops.slice();
    stops[selIdx] = { ...stops[selIdx]!, color: hsvaToHex(alpha ? hsva : { ...hsva, a: 1 }) };
    emit({ ...spec, stops });
  };
  const setStopPos = (pos: number) => {
    const stops = spec.stops.slice();
    stops[selIdx] = { ...stops[selIdx]!, pos: clamp(pos, 0, 100) };
    emit({ ...spec, stops });
  };
  const addStop = (pos: number) => {
    const stops = [...spec.stops, { color: colorAt(spec.stops, pos), pos }];
    setSel(stops.length - 1);
    emit({ ...spec, stops });
  };
  const removeStop = () => {
    if (spec.stops.length <= 2) return;
    const stops = spec.stops.filter((_, i) => i !== selIdx);
    setSel(Math.max(0, selIdx - 1));
    emit({ ...spec, stops });
  };

  return (
    <>
      <div className="pb-cp-grad-bar-row">
        <GradientBar spec={spec} sel={selIdx} onSelect={setSel} onChange={emit} />
        <div className="pb-cp-grad-bar-btns">
          <button
            type="button"
            className="pb-cp-icon-btn"
            aria-label="Add stop"
            onClick={() => addStop(clamp(selStop.pos + 10, 0, 100))}
          >
            +
          </button>
          <button
            type="button"
            className="pb-cp-icon-btn"
            aria-label="Remove stop"
            disabled={spec.stops.length <= 2}
            onClick={removeStop}
          >
            −
          </button>
        </div>
      </div>

      <div className="pb-cp-grad-controls">
        <Segmented<GradientType>
          ariaLabel="Gradient type"
          value={spec.type}
          options={[
            { value: "linear", label: "Linear" },
            { value: "radial", label: "Radial" },
            { value: "conic", label: "Conic" },
          ]}
          onChange={(type) => emit({ ...spec, type })}
        />
        {spec.type === "radial" ? (
          <PositionGrid
            posX={spec.posX}
            posY={spec.posY}
            onChange={(posX, posY) => emit({ ...spec, posX, posY })}
          />
        ) : (
          <AngleDial angle={spec.angle} onChange={(angle) => emit({ ...spec, angle })} />
        )}
        <label className="pb-cp-field pb-cp-pos-field">
          <input
            className="pb-cp-input"
            inputMode="numeric"
            value={Math.round(selStop.pos)}
            aria-label="Stop position"
            onChange={(e) => {
              const n = Number(e.target.value);
              if (e.target.value !== "" && !Number.isNaN(n)) setStopPos(n);
            }}
          />
          <span className="pb-cp-field-label">POS</span>
        </label>
      </div>

      <ColorEditor hsva={selHsva} alpha={alpha} swatches={swatches} onChange={setStopColor} />

      <GradientCodeField
        css={gradientToCss(spec)}
        onGradient={(g) => {
          setSel(0);
          emit(g);
        }}
        onSolid={onChange}
      />

      <div className="pb-cp-presets">
        {PRESETS.map((p, i) => {
          const g = parseGradient(p);
          return (
            <button
              key={i}
              type="button"
              className="pb-cp-preset"
              style={{ background: g ? stopsToBarCss(g.stops) : p }}
              aria-label={`Preset gradient ${i + 1}`}
              onClick={() => {
                if (g) {
                  setSel(0);
                  emit(g);
                }
              }}
            />
          );
        })}
      </div>
    </>
  );
}

/** Paste/edit the raw CSS — parses straight back into the editor, so a string
 *  like `radial-gradient(120% 80% at 80% 0%, …)` doesn't have to be rebuilt
 *  stop-by-stop. Pasting a plain colour (`#FAF8F4`, `rgb(…)`) snaps the whole
 *  fill back to Solid. Focus-aware draft so live edits don't fight typing. */
function GradientCodeField({
  css,
  onGradient,
  onSolid,
}: {
  css: string;
  onGradient: (g: GradientSpec) => void;
  onSolid: (hex: string) => void;
}) {
  const [draft, setDraft] = useState(css);
  const [invalid, setInvalid] = useState(false);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) {
      setDraft(css);
      setInvalid(false);
    }
  }, [css]);

  // Snap to a solid fill when the box holds a plain colour. Deferred to
  // blur/Enter (not every keystroke) — mid-typing "#FAF8F4" passes through the
  // valid 3-digit "#FAF", which shouldn't flip the mode out from under you.
  // Returns true when it committed a solid.
  const commitSolid = (text: string): boolean => {
    const cleaned = text.trim().replace(/;+\s*$/, "");
    if (parseGradient(cleaned)) return false;
    const solid = normalizeColor(cleaned);
    if (solid) {
      onSolid(solid);
      return true;
    }
    return false;
  };

  return (
    <label className="pb-cp-code">
      <span className="pb-cp-field-label">CSS</span>
      <textarea
        className="pb-cp-code-input"
        value={draft}
        rows={2}
        spellCheck={false}
        autoComplete="off"
        data-invalid={invalid || undefined}
        aria-label="Gradient CSS"
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false;
          // A pasted/typed solid commits here; otherwise revert to the gradient.
          if (!commitSolid(draft)) setDraft(css);
          setInvalid(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitSolid(draft);
          }
        }}
        onChange={(e) => {
          const v = e.target.value;
          setDraft(v);
          const cleaned = v.trim().replace(/;+\s*$/, "");
          // Gradients preview live; solids wait for blur/Enter (see above).
          const g = parseGradient(cleaned);
          if (g) {
            setInvalid(false);
            onGradient(g);
          } else {
            setInvalid(cleaned.length > 0 && !normalizeColor(cleaned));
          }
        }}
      />
    </label>
  );
}

function GradientBar({
  spec,
  sel,
  onSelect,
  onChange,
}: {
  spec: GradientSpec;
  sel: number;
  onSelect: (i: number) => void;
  onChange: (next: GradientSpec) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const posFromX = (clientX: number) => {
    const el = ref.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return clamp((clientX - r.left) / r.width, 0, 1) * 100;
  };
  const moveStop = (i: number, pos: number) => {
    const stops = spec.stops.slice();
    stops[i] = { ...stops[i]!, pos };
    onChange({ ...spec, stops });
  };
  const addStop = (clientX: number) => {
    const pos = posFromX(clientX);
    const stops = [...spec.stops, { color: colorAt(spec.stops, pos), pos }];
    onSelect(stops.length - 1);
    onChange({ ...spec, stops });
  };

  return (
    <div
      ref={ref}
      className="pb-cp-grad-bar pb-cp-checker"
      onPointerDown={(e) => {
        e.preventDefault();
        addStop(e.clientX);
      }}
    >
      <div className="pb-cp-grad-bar-fill" style={{ background: stopsToBarCss(spec.stops) }} />
      {spec.stops.map((s, i) => (
        <button
          key={i}
          type="button"
          className="pb-cp-grad-stop"
          data-active={i === sel || undefined}
          style={{ left: `${s.pos}%`, background: s.color }}
          aria-label={`Stop ${i + 1}`}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onSelect(i);
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (e.buttons === 1) moveStop(i, posFromX(e.clientX));
          }}
        />
      ))}
    </div>
  );
}

function AngleDial({ angle, onChange }: { angle: number; onChange: (a: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  const handle = (clientX: number, clientY: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = clientX - (r.left + r.width / 2);
    const y = clientY - (r.top + r.height / 2);
    // 0 = up, 90 = right (CSS gradient-angle convention).
    const a = (Math.atan2(x, -y) * 180) / Math.PI;
    onChange(Math.round((a + 360) % 360));
  };

  return (
    <div className="pb-cp-angle">
      <div
        ref={ref}
        className="pb-cp-dial"
        role="slider"
        tabIndex={0}
        aria-label="Angle"
        aria-valuenow={angle}
        onPointerDown={(e) => {
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          handle(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1) handle(e.clientX, e.clientY);
        }}
        onKeyDown={(e) => {
          const d = e.shiftKey ? 10 : 1;
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") onChange((angle - d + 360) % 360);
          else if (e.key === "ArrowRight" || e.key === "ArrowUp") onChange((angle + d) % 360);
          else return;
          e.preventDefault();
        }}
      >
        <span className="pb-cp-dial-knob" style={{ transform: `rotate(${angle}deg)` }} />
      </div>
      <label className="pb-cp-field pb-cp-angle-field">
        <input
          className="pb-cp-input"
          inputMode="numeric"
          value={Math.round(angle)}
          aria-label="Angle degrees"
          onChange={(e) => {
            const n = Number(e.target.value);
            if (e.target.value !== "" && !Number.isNaN(n)) onChange(((n % 360) + 360) % 360);
          }}
        />
        <span className="pb-cp-field-label">DEG</span>
      </label>
    </div>
  );
}

function PositionGrid({
  posX,
  posY,
  onChange,
}: {
  posX: number;
  posY: number;
  onChange: (x: number, y: number) => void;
}) {
  const cells = [0, 50, 100];
  return (
    <div className="pb-cp-posgrid" role="group" aria-label="Center position">
      {cells.flatMap((y) =>
        cells.map((x) => (
          <button
            key={`${x}-${y}`}
            type="button"
            className="pb-cp-posdot"
            data-active={posX === x && posY === y || undefined}
            aria-label={`${x}% ${y}%`}
            onClick={() => onChange(x, y)}
          />
        )),
      )}
    </div>
  );
}

/* ── Shared colour editor (one HSVA) ───────────────────────────────── */

function ColorEditor({
  hsva,
  onChange,
  alpha,
  swatches,
}: {
  hsva: HSVA;
  onChange: (next: HSVA) => void;
  alpha: boolean;
  swatches?: string[];
}) {
  const [format, setFormat] = useState<Format>("hex");
  const hex = hsvaToHex(hsva);
  const opaqueHex = hsvaToHex({ ...hsva, a: 1 });

  const pickFromScreen = async () => {
    if (!window.EyeDropper) return;
    try {
      const { sRGBHex } = await new window.EyeDropper().open();
      const parsed = parseColor(sRGBHex);
      if (parsed) onChange({ ...parsed, a: hsva.a });
    } catch {
      // User dismissed the eyedropper — nothing to do.
    }
  };

  return (
    <>
      <SaturationArea hsva={hsva} hex={opaqueHex} onChange={onChange} />

      <div className="pb-cp-row">
        {HAS_EYEDROPPER && (
          <button
            type="button"
            className="pb-cp-eyedropper"
            aria-label="Pick color from screen"
            onClick={pickFromScreen}
          >
            <Eyedropper size={16} weight="regular" />
          </button>
        )}
        <span
          className="pb-cp-preview pb-cp-checker"
          style={{ ["--pb-cp-fill" as string]: hex }}
        />
        <div className="pb-cp-sliders">
          <HueSlider hsva={hsva} onChange={onChange} />
          {alpha && <AlphaSlider hsva={hsva} solid={opaqueHex} onChange={onChange} />}
        </div>
      </div>

      <div className="pb-cp-inputs">
        <ColorInputs hsva={hsva} format={format} alpha={alpha} onChange={onChange} />
        <button
          type="button"
          className="pb-cp-format"
          aria-label="Cycle color format"
          title={format.toUpperCase()}
          onClick={() =>
            setFormat(FORMATS[(FORMATS.indexOf(format) + 1) % FORMATS.length]!)
          }
        >
          <span aria-hidden>⇅</span>
        </button>
      </div>

      {swatches && swatches.length > 0 && (
        <div className="pb-cp-swatches">
          {swatches.map((c, i) => (
            <button
              key={`${c}-${i}`}
              type="button"
              className="pb-cp-swatch"
              style={{ background: c }}
              aria-label={`Use ${c}`}
              data-active={(chroma.valid(c) && chroma(c).hex() === opaqueHex) || undefined}
              onClick={() => {
                const parsed = parseColor(c);
                if (parsed) onChange({ ...parsed, a: alpha ? hsva.a : 1 });
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}

/* ── Saturation / Value square ─────────────────────────────────────── */

function SaturationArea({
  hsva,
  hex,
  onChange,
}: {
  hsva: HSVA;
  hex: string;
  onChange: (next: HSVA) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const handle = (clientX: number, clientY: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const s = clamp((clientX - r.left) / r.width, 0, 1);
    const v = 1 - clamp((clientY - r.top) / r.height, 0, 1);
    onChange({ ...hsva, s, v });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 0.1 : 0.01;
    let { s, v } = hsva;
    if (e.key === "ArrowLeft") s -= step;
    else if (e.key === "ArrowRight") s += step;
    else if (e.key === "ArrowUp") v += step;
    else if (e.key === "ArrowDown") v -= step;
    else return;
    e.preventDefault();
    onChange({ ...hsva, s: clamp(s, 0, 1), v: clamp(v, 0, 1) });
  };

  return (
    <div
      ref={ref}
      className="pb-cp-area"
      style={{ background: `hsl(${hsva.h}, 100%, 50%)` }}
      role="slider"
      tabIndex={0}
      aria-label="Saturation and brightness"
      aria-valuetext={`saturation ${Math.round(hsva.s * 100)}%, brightness ${Math.round(hsva.v * 100)}%`}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        handle(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (e.buttons === 1) handle(e.clientX, e.clientY);
      }}
      onKeyDown={onKeyDown}
    >
      <div className="pb-cp-area-sat" />
      <div className="pb-cp-area-val" />
      <span
        className="pb-cp-thumb"
        style={{
          left: `${hsva.s * 100}%`,
          top: `${(1 - hsva.v) * 100}%`,
          background: hex,
        }}
      />
    </div>
  );
}

/* ── Linear sliders (hue + alpha share the geometry) ───────────────── */

function Track({
  ratio,
  thumbColor,
  ariaLabel,
  ariaValue,
  className,
  style,
  onRatio,
  step,
}: {
  ratio: number;
  thumbColor: string;
  ariaLabel: string;
  ariaValue: number;
  className: string;
  style?: React.CSSProperties;
  onRatio: (r: number) => void;
  step: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const handle = (clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    onRatio(clamp((clientX - r.left) / r.width, 0, 1));
  };

  return (
    <div
      ref={ref}
      className={`pb-cp-slider ${className}`}
      style={style}
      role="slider"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-valuenow={ariaValue}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        handle(e.clientX);
      }}
      onPointerMove={(e) => {
        if (e.buttons === 1) handle(e.clientX);
      }}
      onKeyDown={(e) => {
        const d = e.shiftKey ? step * 10 : step;
        if (e.key === "ArrowLeft" || e.key === "ArrowDown") onRatio(clamp(ratio - d, 0, 1));
        else if (e.key === "ArrowRight" || e.key === "ArrowUp") onRatio(clamp(ratio + d, 0, 1));
        else return;
        e.preventDefault();
      }}
    >
      <span
        className="pb-cp-thumb"
        style={{ left: `${ratio * 100}%`, top: "50%", background: thumbColor }}
      />
    </div>
  );
}

function HueSlider({ hsva, onChange }: { hsva: HSVA; onChange: (n: HSVA) => void }) {
  return (
    <Track
      className="pb-cp-hue"
      style={{ background: HUE_GRADIENT }}
      ratio={hsva.h / 360}
      step={1 / 360}
      thumbColor={`hsl(${hsva.h}, 100%, 50%)`}
      ariaLabel="Hue"
      ariaValue={Math.round(hsva.h)}
      onRatio={(r) => onChange({ ...hsva, h: r * 360 })}
    />
  );
}

function AlphaSlider({
  hsva,
  solid,
  onChange,
}: {
  hsva: HSVA;
  solid: string;
  onChange: (n: HSVA) => void;
}) {
  return (
    <Track
      className="pb-cp-alpha pb-cp-checker"
      style={{ ["--pb-cp-fill" as string]: solid }}
      ratio={hsva.a}
      step={0.01}
      thumbColor={solid}
      ariaLabel="Opacity"
      ariaValue={Math.round(hsva.a * 100)}
      onRatio={(a) => onChange({ ...hsva, a })}
    />
  );
}

/* ── Numeric / hex inputs ──────────────────────────────────────────── */

function ColorInputs({
  hsva,
  format,
  alpha,
  onChange,
}: {
  hsva: HSVA;
  format: Format;
  alpha: boolean;
  onChange: (n: HSVA) => void;
}) {
  if (format === "hex") {
    return (
      <HexField
        hex={alpha ? hsvaToHex(hsva) : hsvaToHex({ ...hsva, a: 1 })}
        onCommit={(c) => onChange({ ...c, a: alpha ? c.a : 1 })}
      />
    );
  }

  if (format === "rgb") {
    const [r, g, b] = chroma.hsv(hsva.h, hsva.s, hsva.v).rgb();
    const setChannel = (idx: 0 | 1 | 2, val: number) => {
      const rgb: [number, number, number] = [r!, g!, b!];
      rgb[idx] = val;
      const next = chroma(rgb[0], rgb[1], rgb[2], "rgb").hsv();
      onChange({
        h: Number.isNaN(next[0]) ? hsva.h : next[0],
        s: next[1],
        v: next[2],
        a: hsva.a,
      });
    };
    return (
      <div className="pb-cp-channels">
        <Channel label="R" value={Math.round(r!)} max={255} onCommit={(n) => setChannel(0, n)} />
        <Channel label="G" value={Math.round(g!)} max={255} onCommit={(n) => setChannel(1, n)} />
        <Channel label="B" value={Math.round(b!)} max={255} onCommit={(n) => setChannel(2, n)} />
      </div>
    );
  }

  // hsl
  const [h, s, l] = chroma.hsv(hsva.h, hsva.s, hsva.v).hsl();
  const setHsl = (idx: 0 | 1 | 2, val: number) => {
    const arr: [number, number, number] = [Number.isNaN(h) ? hsva.h : h!, s!, l!];
    arr[idx] = idx === 0 ? val : val / 100;
    const next = chroma.hsl(arr[0], arr[1], arr[2]).hsv();
    onChange({
      h: Number.isNaN(next[0]) ? hsva.h : next[0],
      s: next[1],
      v: next[2],
      a: hsva.a,
    });
  };
  return (
    <div className="pb-cp-channels">
      <Channel label="H" value={Math.round(Number.isNaN(h) ? hsva.h : h!)} max={360} onCommit={(n) => setHsl(0, n)} />
      <Channel label="S" value={Math.round(s! * 100)} max={100} onCommit={(n) => setHsl(1, n)} />
      <Channel label="L" value={Math.round(l! * 100)} max={100} onCommit={(n) => setHsl(2, n)} />
    </div>
  );
}

/** Focus-aware draft so external updates (dragging) don't fight typing. */
function HexField({ hex, onCommit }: { hex: string; onCommit: (c: HSVA) => void }) {
  const [draft, setDraft] = useState(hex);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(hex);
  }, [hex]);

  return (
    <label className="pb-cp-field pb-cp-field-hex">
      <input
        className="pb-cp-input"
        value={draft}
        spellCheck={false}
        autoComplete="off"
        aria-label="Hex color"
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false;
          setDraft(hex);
        }}
        onChange={(e) => {
          const v = e.target.value;
          setDraft(v);
          const norm = v.trim().startsWith("#") ? v.trim() : `#${v.trim()}`;
          const parsed = parseColor(norm);
          if (parsed) onCommit(parsed);
        }}
      />
      <span className="pb-cp-field-label">HEX</span>
    </label>
  );
}

function Channel({
  label,
  value,
  max,
  onCommit,
}: {
  label: string;
  value: number;
  max: number;
  onCommit: (n: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(String(value));
  }, [value]);

  return (
    <label className="pb-cp-field">
      <input
        className="pb-cp-input"
        inputMode="numeric"
        value={draft}
        aria-label={label}
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false;
          setDraft(String(value));
        }}
        onChange={(e) => {
          const v = e.target.value;
          setDraft(v);
          const n = Number(v);
          if (v !== "" && !Number.isNaN(n)) onCommit(clamp(Math.round(n), 0, max));
        }}
      />
      <span className="pb-cp-field-label">{label}</span>
    </label>
  );
}

/* ── Tiny segmented control ────────────────────────────────────────── */

function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="pb-cp-seg" role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="pb-cp-seg-btn"
          data-active={value === o.value || undefined}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
