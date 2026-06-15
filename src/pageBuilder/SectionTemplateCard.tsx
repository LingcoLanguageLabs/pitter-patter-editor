/**
 * One preview card in the "Add a section" modal — pagy's
 * `section-template-card.tsx`.
 *
 * Renders the template through `RenderNode` (the same ProseMirror-free
 * walker the published site uses) inside the editor's exact class chain
 * (`.pb-site > .pb-canvas.site > .pb-canvas-scroll > .shuffle-wrapper >
 * .ProseMirror > .pb-page`), so the preview is pixel-identical to what
 * the section will look like once inserted. The chain is laid out at a
 * fixed desktop `DESIGN_WIDTH` and CSS-`scale()`d down to the card's
 * measured width; we observe the rendered height so the card is exactly
 * tall enough for the scaled content (no clipping, no dead space).
 *
 * Theme colours/fonts come for free: `<ThemeStyle>` injects the active
 * theme's vars scoped to `.site` into the document head, so any `.site`
 * here inherits them.
 */

"use client";

import { memo, useLayoutEffect, useRef, useState } from "react";

import { RenderNode } from "./runtime/renderNode";
import type { JsonNode } from "./runtime/shuffleLayout";
import { themeClassName, type Theme } from "./theme/css";

/** Desktop width the preview is composed at before scaling down. Roughly
 *  the canvas's widest content layout, so previews read like the editor. */
const DESIGN_WIDTH = 1320;

interface SectionTemplateCardProps {
  template: JsonNode;
  theme: Theme;
  onSelect: () => void;
}

export const SectionTemplateCard = memo(function SectionTemplateCard({
  template,
  theme,
  onSelect,
}: SectionTemplateCardProps) {
  const cardRef = useRef<HTMLButtonElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  // Measured from the card's own box (not the list's padded clientWidth), so
  // the scaled stage fills the card exactly — no right-edge clipping.
  const [cardWidth, setCardWidth] = useState(0);
  const [naturalHeight, setNaturalHeight] = useState(0);
  const scale = cardWidth > 0 ? cardWidth / DESIGN_WIDTH : 0;

  // The card's rendered width (drives the scale).
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const measure = () => setCardWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The unscaled content height, so the card sizes to scale·height.
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setNaturalHeight(el.scrollHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // Text-only sections settle their height only once the web font swaps in;
    // the first pass can run against the fallback font and under-measure. Re-
    // measure when fonts are ready (and on the next frame, after reflow).
    let cancelled = false;
    document.fonts?.ready
      .then(() => {
        if (!cancelled) requestAnimationFrame(measure);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      ro.disconnect();
    };
  }, [template]);

  return (
    <button
      ref={cardRef}
      type="button"
      className="pb-section-card"
      onClick={onSelect}
      style={{ height: naturalHeight > 0 && scale > 0 ? naturalHeight * scale : undefined }}
    >
      <div
        ref={stageRef}
        className="pb-section-card-stage"
        style={{ width: DESIGN_WIDTH, transform: `scale(${scale})`, transformOrigin: "0 0" }}
      >
        <div className="pb-site">
          <div className={`pb-canvas site ${themeClassName(theme)}`}>
            <div className="pb-canvas-scroll">
              <div className="shuffle-wrapper">
                <div className="ProseMirror">
                  <div className="pb-page" data-active data-node-type="page">
                    <RenderNode node={template} index={0} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
});
