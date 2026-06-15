/**
 * Renders a whole site (a deck of pages) from document JSON — the
 * standalone, ProseMirror-free render path for the published site AND the
 * editor's "experience the site" preview (one renderer, so preview ===
 * published). ProseMirror is the authoring runtime only; nothing here touches
 * it.
 *
 * It reproduces the editor's class chain so all existing CSS applies for
 * free: `.pb-site > .pb-canvas.site <theme> > .pb-canvas-scroll >
 * .shuffle-wrapper > .ProseMirror > .pb-page > …`. The only piece dropped
 * vs. the editor is the `.shuffle-skeleton` drag overlay; the `.pb-site`
 * root re-enables the interactivity the editor's `.ProseMirror` rules
 * suppress (media pointer-events, link cursor) — see `page-builder.css`.
 *
 * Theme: injects `themeToCss(theme)` + the font-face block and stamps
 * `themeClassName(theme)` on `.site`, exactly like `<ThemeStyle>` +
 * `<Canvas>` do in the editor.
 *
 * Navigation + transitions: deck-page links + (with `deckNav`) arrow/space/
 * page keys switch the rendered page in place. Each switch plays the
 * destination page's transition (`transitions.ts`) via Framer Motion's
 * `<AnimatePresence>` + `<motion.div>` — the entering page plays
 * `initial → animate`, the leaving page `animate → exit`, overlapping in one
 * `.pb-page-anim` grid cell. The first page lands without animating
 * (`initial={false}` on it only).
 */

import { AnimatePresence, motion } from "motion/react";
import { curtains } from "motion-plus-dom/curtains";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { FONTS_DEFAULT } from "../theme/fonts";
import { allFontFaceCss } from "../theme/font-face-css";
import { themeClassName, themeToCss, type Theme } from "../theme/css";
import {
  buildPageMotion,
  defaultVariant,
  prefersReducedMotion,
  transitionDurationSec,
  transitionTiming,
  type TransitionDirection,
  type TransitionSpeed,
  type TransitionType,
} from "../transitions";
import { curtainEffectFor, isCurtainsId } from "./curtainsEffects";
import { RenderNode, SiteNavProvider } from "./renderNode";
import type { JsonNode } from "./shuffleLayout";

import "@pitter-patter/shuffle/style/shuffle.css";
import "../page-builder.css";

const FONT_FACE_CSS = allFontFaceCss(FONTS_DEFAULT);

export interface SiteRendererProps {
  /** The document JSON — `doc.toJSON()` (or stored published content). */
  doc: JsonNode;
  /** Site theme (colors + fonts + button/input tokens). */
  theme: Theme;
  /** Page id to open on; defaults to the first page. */
  initialPageId?: string;
  /** Enable present-style keyboard stepping (←/→/↑/↓/Space/PageUp-Down). Off
   *  for a normal published site; the preview overlay turns it on. */
  deckNav?: boolean;
}

function pageId(page: JsonNode): string {
  return (page.attrs?.["id"] as string) || "";
}

const FORWARD_KEYS = ["ArrowRight", "ArrowDown", "PageDown", " "];
const BACKWARD_KEYS = ["ArrowLeft", "ArrowUp", "PageUp"];

export function SiteRenderer({
  doc,
  theme,
  initialPageId,
  deckNav,
}: SiteRendererProps) {
  const pages = useMemo(
    () => (doc.content ?? []).filter((n) => n.type === "page"),
    [doc],
  );

  // Active page + the direction we arrived from (drives slide/flip handedness).
  const [active, setActive] = useState<{ id: string; dir: TransitionDirection }>(
    () => ({
      id: initialPageId || (pages[0] ? pageId(pages[0]) : ""),
      dir: "forward",
    }),
  );

  // Scope element for Motion+ curtains overlays (must be positioned — `.pb-canvas`
  // is `position: relative`). The overlay mounts inside it and tracks its box.
  const canvasRef = useRef<HTMLDivElement>(null);

  // Navigate to a page, inferring direction from deck order (later → forward).
  const navigate = useCallback(
    (toId: string) => {
      if (toId === active.id) return;
      const from = pages.findIndex((p) => pageId(p) === active.id);
      const to = pages.findIndex((p) => pageId(p) === toId);
      if (to === -1) return;
      const dir: TransitionDirection = to >= from ? "forward" : "backward";
      const dest = pages[to];
      const destType = (dest?.attrs?.["transition"] as string) || "none";

      // Curtains group → the real Motion+ `curtains()`: it covers the scoped
      // deck, runs our page swap while occluded, then reveals. We commit the
      // React state change inside the callback with `flushSync` so the swap is
      // synchronous the way the API expects. (Other transitions fall through to
      // the Framer Motion AnimatePresence path below.)
      if (isCurtainsId(destType)) {
        const variant =
          (dest?.attrs?.["transitionVariant"] as string) || defaultVariant(destType);
        const speed =
          (dest?.attrs?.["transitionSpeed"] as TransitionSpeed) || "medium";
        void curtains(
          () => {
            flushSync(() => setActive({ id: toId, dir }));
          },
          {
            effect: curtainEffectFor(destType, variant),
            transition: { duration: transitionDurationSec(speed) },
            scope: canvasRef.current ?? undefined,
          },
        );
        return;
      }
      setActive({ id: toId, dir });
    },
    [pages, active.id],
  );

  // Present-style keyboard stepping (opt-in). Read-only content, so there's no
  // input to steal these keys from.
  useEffect(() => {
    if (!deckNav) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const idx = pages.findIndex((p) => pageId(p) === active.id);
      if (idx === -1) return;
      if (FORWARD_KEYS.includes(e.key)) {
        const next = pages[idx + 1];
        if (next) {
          e.preventDefault();
          navigate(pageId(next));
        }
      } else if (BACKWARD_KEYS.includes(e.key)) {
        const prev = pages[idx - 1];
        if (prev) {
          e.preventDefault();
          navigate(pageId(prev));
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deckNav, pages, active.id, navigate]);

  const activePage =
    pages.find((p) => pageId(p) === active.id) ?? pages[0] ?? null;
  const transitionType =
    (activePage?.attrs?.["transition"] as TransitionType) || "none";
  const transitionVariant =
    (activePage?.attrs?.["transitionVariant"] as string) ||
    defaultVariant(transitionType);
  const transitionSpeed =
    (activePage?.attrs?.["transitionSpeed"] as TransitionSpeed) || "medium";
  // Curtains-group pages render plain — `curtains()` runs their transition via
  // its own overlay during the swap, so no Framer Motion wrapper here.
  const animated =
    transitionType !== "none" &&
    !isCurtainsId(transitionType) &&
    !prefersReducedMotion();

  // First page lands without animating; every navigation after animates. We do
  // this on the motion element's own `initial`, not AnimatePresence's.
  const firstRender = useRef(true);
  const isFirst = firstRender.current;
  useEffect(() => {
    firstRender.current = false;
  }, []);

  const motion3 = buildPageMotion(transitionType, transitionVariant, active.dir);
  const timing = transitionTiming(
    transitionSpeed,
    transitionType === "cut" ? { duration: 0.12 } : undefined,
  );

  const css = useMemo(() => `${FONT_FACE_CSS}\n${themeToCss(theme)}`, [theme]);

  return (
    <div className="pb-site">
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div ref={canvasRef} className={`pb-canvas site ${themeClassName(theme)}`}>
        <div className="pb-canvas-scroll">
          <div className="shuffle-wrapper">
            {/* `ProseMirror` class is reused so the grid + text rules scoped
                under `.pb-canvas-scroll .ProseMirror` apply; this is a plain
                div, not an editor. */}
            <div className="ProseMirror">
              <SiteNavProvider navigate={navigate}>
                {animated ? (
                  <AnimatePresence>
                    <motion.div
                      // `.pb-page-anim` is a subgrid pass-through stacked in one
                      // grid row, so entering + leaving pages overlap during the
                      // transition while the `.pb-page` subgrid columns survive.
                      key={active.id}
                      className="pb-page-anim"
                      initial={isFirst ? false : motion3.initial}
                      animate={motion3.animate}
                      exit={motion3.exit}
                      transition={timing}
                    >
                      {activePage && <RenderNode node={activePage} index={0} />}
                    </motion.div>
                  </AnimatePresence>
                ) : (
                  activePage && <RenderNode node={activePage} index={0} />
                )}
              </SiteNavProvider>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
