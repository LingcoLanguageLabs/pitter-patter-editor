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
import { RenderNode } from "./renderNode";
import { SiteNavProvider, type SiteNav } from "./siteNav";
import { getItemDefinition } from "../items/registry";
import { GradingProvider, type ItemLocation } from "../items/shared/grading";
import { VariableScopeProvider } from "../variables/scope";
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

/** Does `page` show the global `kind` master? Needs a master to exist, no
 *  page-level override of that kind, and the page's `hide*` flag unset. */
function barShowsGlobal(
  page: JsonNode | null,
  kind: "header" | "footer",
  master: JsonNode | null,
): boolean {
  if (!page || !master) return false;
  if ((page.content ?? []).some((n) => n.type === kind)) return false; // override
  const hidden = kind === "header" ? page.attrs?.["hideHeader"] : page.attrs?.["hideFooter"];
  return !hidden;
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

  // The site-wide masters — the doc's own header / footer (`header? page+
  // footer?`), rendered around every page that inherits them.
  const globalHeader = useMemo(
    () => (doc.content ?? []).find((n) => n.type === "header") ?? null,
    [doc],
  );
  const globalFooter = useMemo(
    () => (doc.content ?? []).find((n) => n.type === "footer") ?? null,
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

  // Step the deck relative to the current page — drives the prev/next button
  // actions. Out-of-range (no prev on the first page) is a no-op.
  const navigateBy = useCallback(
    (delta: number) => {
      const idx = pages.findIndex((p) => pageId(p) === active.id);
      if (idx === -1) return;
      const target = pages[idx + delta];
      if (target) navigate(pageId(target));
    },
    [pages, active.id, navigate],
  );

  const canNavigateBy = useCallback(
    (delta: number) => {
      const idx = pages.findIndex((p) => pageId(p) === active.id);
      return idx !== -1 && !!pages[idx + delta];
    },
    [pages, active.id],
  );

  // sectionId (htmlId) → the page it lives on, so "Go to section" can switch
  // pages before scrolling (only the active page is mounted).
  const sectionPageMap = useMemo(() => {
    const map = new Map<string, string>();
    const visit = (n: JsonNode, pid: string) => {
      if (n.type === "section") {
        const hid = n.attrs?.["htmlId"] as string | undefined;
        if (hid) map.set(hid, pid);
      }
      (n.content ?? []).forEach((c) => visit(c, pid));
    };
    for (const p of pages) visit(p, pageId(p));
    return map;
  }, [pages]);

  // Scroll to a section by its anchor id, switching to its page first if needed.
  // After a page switch the new section mounts a few frames later (transitions
  // animate it in), so poll on rAF until it appears, then smooth-scroll.
  const goToSection = useCallback(
    (sectionId: string) => {
      if (!sectionId) return;
      const scroll = () => {
        const root = canvasRef.current;
        if (!root) return false;
        let el: Element | null = null;
        try {
          el = root.querySelector(`#${CSS.escape(sectionId)}`);
        } catch {
          el = null;
        }
        if (!el) return false;
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return true;
      };
      const targetPage = sectionPageMap.get(sectionId);
      if (targetPage && targetPage !== active.id) {
        navigate(targetPage);
        let tries = 0;
        const tick = () => {
          if (scroll() || tries++ > 60) return;
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      } else {
        scroll();
      }
    },
    [sectionPageMap, active.id, navigate],
  );

  const nav = useMemo<SiteNav>(
    () => ({ navigate, navigateBy, canNavigateBy, goToSection }),
    [navigate, navigateBy, canNavigateBy, goToSection],
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
  // Deck position for the `page.*` variables (1-based number + total).
  const activeIndex = pages.findIndex((p) => pageId(p) === active.id);
  const pageNumber = (activeIndex >= 0 ? activeIndex : 0) + 1;
  const pageCount = pages.length;

  // Item map (itemId → page/section) for the grading store — lets a Check
  // button resolve a scope to its prompts even when they're on an unmounted
  // page. Sections are keyed by `htmlId` (the same id nav targets + the Check
  // form auto-assigns when a section is picked).
  const itemLocations = useMemo<ItemLocation[]>(() => {
    const out: ItemLocation[] = [];
    for (const p of pages) {
      const pid = pageId(p);
      const visit = (n: JsonNode, sectionId: string) => {
        const sid =
          n.type === "section"
            ? (n.attrs?.["htmlId"] as string) || ""
            : sectionId;
        const itemId = (n.attrs?.["itemId"] as string) || "";
        const def = getItemDefinition(n.type);
        if (itemId && def) {
          // Bind this item's registered grader to its serialized def so the
          // grading store can score a response type-agnostically (each type
          // owns its grade()). Serialize once here; ungradable types have no
          // grader, so they only count toward `total`.
          let grade: ItemLocation["grade"];
          const graderFn = def.grade;
          if (graderFn) {
            const itemDef = def.serialize(n);
            grade = (response) => graderFn(itemDef, response);
          }
          out.push({ itemId, pageId: pid, sectionId: sid, grade });
        }
        (n.content ?? []).forEach((c) => visit(c, sid));
      };
      (p.content ?? []).forEach((c) => visit(c, ""));
    }
    return out;
  }, [pages]);

  // "Current section" tracking: the section most in view on the active page, via
  // an IntersectionObserver, reset per page. It drives two things:
  //   • `currentSectionId` (grading) — the in-view section's `htmlId`, so a
  //     pinned-bar "Check current section" grades what the reader is looking at.
  //     Only id-bearing sections can be a grade target, so it ignores the rest.
  //   • `currentSectionName` (the `section.name` variable) — read from the
  //     section's `data-section-name` stamp, so it resolves for EVERY section,
  //     including those with no `htmlId` (which emit no `id`).
  const [currentSectionId, setCurrentSectionId] = useState("");
  const [currentSectionName, setCurrentSectionName] = useState("");
  useEffect(() => {
    const root = canvasRef.current;
    if (!root) return;
    const sections = Array.from(
      root.querySelectorAll<HTMLElement>('[data-node-type="section"]'),
    );
    if (sections.length === 0) {
      setCurrentSectionId("");
      setCurrentSectionName("");
      return;
    }
    setCurrentSectionId(sections.find((s) => s.id)?.id ?? "");
    setCurrentSectionName(sections[0]!.getAttribute("data-section-name") ?? "");
    const ratios = new Map<HTMLElement, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          ratios.set(e.target as HTMLElement, e.intersectionRatio);
        }
        // Best overall → the name; best among id-bearing → the grade target (so
        // `currentSectionId` keeps its id-only semantics).
        let bestEl: HTMLElement | null = null;
        let bestRatio = -1;
        let bestIdEl: HTMLElement | null = null;
        let bestIdRatio = -1;
        for (const [el, r] of ratios) {
          if (r > bestRatio) {
            bestRatio = r;
            bestEl = el;
          }
          if (el.id && r > bestIdRatio) {
            bestIdRatio = r;
            bestIdEl = el;
          }
        }
        if (bestEl) {
          setCurrentSectionName(bestEl.getAttribute("data-section-name") ?? "");
        }
        if (bestIdEl) setCurrentSectionId(bestIdEl.id);
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [active.id]);

  // `page.name` for the variable scope: the active page's title.
  const pageName = (activePage?.attrs?.["title"] as string) || "Untitled";

  // Whether the active page shows each master: it must exist, the page must not
  // carry its own override of that kind, and the page must not hide it. (When
  // the page overrides, its own bar renders inside the page via `renderChildren`
  // instead — so the master must stay out to avoid doubling up.) Mirrors
  // `resolvePageBarScope` for the JSON walker.
  const showGlobalHeader = useMemo(
    () => barShowsGlobal(activePage, "header", globalHeader),
    [activePage, globalHeader],
  );
  const showGlobalFooter = useMemo(
    () => barShowsGlobal(activePage, "footer", globalFooter),
    [activePage, globalFooter],
  );
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
              <SiteNavProvider nav={nav}>
                {/* Grading store wraps EVERYTHING (incl. the masters), so a
                    Check button in a pinned header/footer can grade prompts on
                    the page. Responses persist here across page transitions. */}
                <GradingProvider
                  items={itemLocations}
                  currentPageId={active.id}
                  currentSectionId={currentSectionId}
                >
                  <VariableScopeProvider
                    pageNumber={pageNumber}
                    pageCount={pageCount}
                    pageName={pageName}
                    sectionName={currentSectionName}
                  >
                  {/* Masters bookend the page (and persist across transitions —
                      they sit OUTSIDE the animating page wrapper). A page that
                      overrides renders its own bar inside the page instead. */}
                  {showGlobalHeader && globalHeader && (
                    <RenderNode node={globalHeader} index={0} />
                  )}
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
                  {showGlobalFooter && globalFooter && (
                    <RenderNode node={globalFooter} index={0} />
                  )}
                  </VariableScopeProvider>
                </GradingProvider>
              </SiteNavProvider>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
