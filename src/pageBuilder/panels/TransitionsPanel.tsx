/**
 * Transitions sub-panel — the page's entry-transition gallery, reached from a
 * page's right-click menu in the Pages rail (the `Intersect` item). A full
 * sub-panel like Buttons, not a popover.
 *
 * Layout mirrors PowerPoint's Transitions gallery: the catalog grouped
 * Subtle / Exciting / Dynamic, each effect a card (self-drawn SVG thumbnail +
 * name), the current page's choice highlighted. Hovering a card that has
 * "Effect Options" (variants) opens a floating flyout of those options — pick
 * one to apply it. A Duration control + "Apply to all pages" sit at the top.
 *
 * It edits the ACTIVE page's `transition` / `transitionVariant` /
 * `transitionSpeed` attrs via `pageCommands`; values come from the store's
 * mirrored deck, so edits round-trip back and the UI reflects them. The
 * transition only *plays* while viewing the site (`<SiteRenderer>`).
 */

import {
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  safePolygon,
  shift,
  useFloating,
  useHover,
  useInteractions,
} from "@floating-ui/react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { Field, Segmented } from "../blockSettings/forms";
import { setAllPagesTransition, setPageTransition } from "../pageCommands";
import { navigateTo, usePageBuilderStore } from "../store";
import {
  TRANSITION_EASE,
  TRANSITION_GROUPS,
  TRANSITIONS,
  TRANSITION_SPEED_LABELS,
  TRANSITION_SPEED_VALUES,
  buildPageMotion,
  defaultVariant,
  isImplemented,
  type TransitionDef,
  type TransitionSpeed,
  type TransitionType,
} from "../transitions";
import { TransitionThumbnail } from "./TransitionThumbnail";

export function TransitionsPanel() {
  const view = usePageBuilderStore((s) => s.pagesView);
  const pages = usePageBuilderStore((s) => s.pages);
  const activeId = usePageBuilderStore((s) => s.activePageId);
  const active = pages.find((p) => p.id === activeId) ?? null;

  const currentId = active?.transition ?? "none";
  const currentVariant = active?.transitionVariant ?? "";
  const speed = active?.transitionSpeed ?? "medium";

  /** Apply a transition id (+ optional Effect Option) to the active page. */
  const pick = (id: TransitionType, variant?: string) => {
    if (!view || !activeId) return;
    const v = variant ?? (id === currentId ? currentVariant : defaultVariant(id));
    setPageTransition(view, activeId, id, v, speed);
  };

  const setSpeed = (s: TransitionSpeed) => {
    if (view && activeId) setPageTransition(view, activeId, currentId, currentVariant, s);
  };

  return (
    <>
      <button
        type="button"
        className="pb-panel-back"
        onClick={() => navigateTo("pages")}
        aria-label="Back to pages"
      >
        ←
      </button>
      <div className="pb-panel-titlebar">
        <h1 className="pb-panel-title">Transition</h1>
      </div>
      {active && (
        <p className="pb-trans-subtitle">
          {active.title || "Untitled"}
        </p>
      )}

      {/* Duration + apply-to-all */}
      <Field label="Duration">
        <Segmented<TransitionSpeed>
          ariaLabel="Transition duration"
          value={speed}
          options={TRANSITION_SPEED_VALUES.map((v) => ({
            value: v,
            label: TRANSITION_SPEED_LABELS[v],
          }))}
          onChange={setSpeed}
        />
      </Field>
      <button
        type="button"
        className="pb-trans-apply"
        disabled={!view || !active}
        onClick={() =>
          view && setAllPagesTransition(view, currentId, currentVariant, speed)
        }
      >
        Apply to all pages
      </button>

      {/* Gallery */}
      <div className="pb-trans-gallery">
        {TRANSITION_GROUPS.map((group) => (
          <section key={group.id} className="pb-trans-group">
            <h2 className="pb-trans-group-title">{group.label}</h2>
            <div className="pb-trans-grid">
              {TRANSITIONS.filter((t) => t.group === group.id).map((def) => (
                <TransitionCard
                  key={def.id}
                  def={def}
                  selected={def.id === currentId}
                  activeVariant={def.id === currentId ? currentVariant : ""}
                  onPick={pick}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

/**
 * One gallery card. Clicking applies the transition (keeping the current
 * Effect Option when re-selecting the same one, else its default). If the
 * transition has Effect Options, hovering opens a floating flyout to pick one —
 * `safePolygon` lets the cursor travel from card to flyout without it closing.
 */
function TransitionCard({
  def,
  selected,
  activeVariant,
  onPick,
}: {
  def: TransitionDef;
  selected: boolean;
  activeVariant: string;
  onPick: (id: TransitionType, variant?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  // The Effect Option currently pointed at in the flyout — drives the card's
  // live preview so hovering "From Left" plays From Left, not just the default.
  const [hoverVariant, setHoverVariant] = useState<string | null>(null);
  const hasVariants = !!def.variants?.length;
  // Animate a faithful mini-preview on hover — but only for transitions we
  // actually animate. For the not-yet-built (fallback) effects and "None", a
  // preview would mislead, so we keep the static glyph.
  const canPreview = isImplemented(def.id) && def.id !== "none";

  const { refs, floatingStyles, context } = useFloating({
    open: open && hasVariants,
    onOpenChange: (next) => {
      setOpen(next);
      if (!next) setHoverVariant(null);
    },
    placement: "right-start",
    middleware: [offset(8), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });
  const hover = useHover(context, {
    enabled: hasVariants,
    delay: { open: 40, close: 80 },
    handleClose: safePolygon(),
  });
  const { getReferenceProps, getFloatingProps } = useInteractions([hover]);

  // Thumbnail reflects the chosen Effect Option when this card is selected.
  const thumbVariant = selected && activeVariant ? activeVariant : defaultVariant(def.id);
  // Keep the live preview running while the card OR its flyout is hovered
  // (moving onto the flyout fires the card's mouseleave), and let a pointed-at
  // Effect Option override which variant plays.
  const showPreview = (hovered || open) && canPreview;
  const previewVariant = hoverVariant ?? thumbVariant;

  return (
    <>
      <button
        ref={refs.setReference}
        type="button"
        className="pb-trans-card"
        data-selected={selected || undefined}
        data-stub={!isImplemented(def.id) || undefined}
        title={isImplemented(def.id) ? def.label : `${def.label} (preview pending)`}
        onClick={() => onPick(def.id)}
        {...getReferenceProps({
          onMouseEnter: () => setHovered(true),
          onMouseLeave: () => setHovered(false),
        })}
      >
        <span className="pb-trans-card-thumb">
          {showPreview ? (
            <MiniPreview id={def.id} variant={previewVariant} />
          ) : (
            <TransitionThumbnail id={def.id} variant={thumbVariant} />
          )}
        </span>
        <span className="pb-trans-card-name">{def.label}</span>
        {hasVariants && <span className="pb-trans-card-caret" aria-hidden>▾</span>}
      </button>

      {open && hasVariants && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            className="pb-trans-flyout"
            style={floatingStyles}
            {...getFloatingProps()}
          >
            <div className="pb-trans-flyout-title">{def.label}</div>
            {def.variants!.map((variant) => (
              <button
                key={variant.id}
                type="button"
                className="pb-trans-flyout-option"
                data-selected={(selected && activeVariant === variant.id) || undefined}
                onMouseEnter={() => setHoverVariant(variant.id)}
                onMouseLeave={() => setHoverVariant(null)}
                onFocus={() => setHoverVariant(variant.id)}
                onBlur={() => setHoverVariant(null)}
                onClick={() => {
                  onPick(def.id, variant.id);
                  setHoverVariant(null);
                  setOpen(false);
                }}
              >
                <span className="pb-trans-flyout-thumb">
                  <TransitionThumbnail id={def.id} variant={variant.id} />
                </span>
                <span className="pb-trans-flyout-label">{variant.label}</span>
              </button>
            ))}
          </div>
        </FloatingPortal>
      )}
    </>
  );
}

/**
 * A looping, faithful preview of a transition: two mini "pages" (A/B) that
 * swap on an interval, running the EXACT `buildPageMotion` output the real
 * transition uses (percentages/clip/transform all scale to the mini box). Only
 * mounted while a card is hovered, so the loop stops when you move away.
 */
function MiniPreview({ id, variant }: { id: string; variant: string }) {
  // Loop the real transition by swapping the keyed page (A↔B) on an interval;
  // <AnimatePresence> plays the destination's initial→animate while the leaving
  // one plays animate→exit — the same Framer Motion driver as the live deck.
  const [step, setStep] = useState(0);
  const v = variant || defaultVariant(id);

  // A tight cadence (≈ animation + short hold) so the loop reads as motion
  // rather than a frozen frame. Restarting the timer on effect/variant change
  // also replays *immediately*, so pointing at a flyout option plays it at once
  // instead of waiting out the current cycle. Skip that snap on first mount so
  // a freshly-hovered card plays its entry from rest.
  const firstRun = useRef(true);
  useEffect(() => {
    if (!firstRun.current) setStep((s) => s + 1);
    firstRun.current = false;
    const interval = setInterval(() => setStep((s) => s + 1), 1050);
    return () => clearInterval(interval);
  }, [id, v]);

  const page = step % 2 === 0 ? "a" : "b";
  const m = buildPageMotion(id, v, "forward");

  return (
    <span className="pb-trans-preview">
      <AnimatePresence>
        <motion.span
          key={page}
          className={`pb-trans-preview-page -${page}`}
          initial={m.initial}
          animate={m.animate}
          exit={m.exit}
          transition={{ duration: 0.5, ease: TRANSITION_EASE }}
        />
      </AnimatePresence>
    </span>
  );
}
