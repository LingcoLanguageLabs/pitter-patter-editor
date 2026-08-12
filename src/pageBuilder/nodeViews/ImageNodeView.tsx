/**
 * NodeView for the `image` schema node — pagy's `.wrapper` + `.media`:
 *
 *   <figure class="pb-image …">        ← full-footprint grid item; bears the
 *     <div class="pb-image-media">          selection ring (so it outlines the
 *       <img>                               BLOCK), transparent otherwise
 *       <span .pb-image-resize-handle ×2>
 *
 * The media is what sizes (a % of the footprint), aligns within it, and carries
 * the frame; the figure stays full-width so the ring shows where the image sits
 * inside the block. The handles live inside the media (absolutely positioned),
 * so they track the rendered image — inset within the footprint when < full.
 * Dragging a handle sets the image's `width`, cleared back to `null` at full so
 * the figure goes full-bleed and the Align control hides — pagy's
 * `width >= maxWidth ? null` + `{element.width && …}`.
 *
 * PINNED MODE (`position: "pinned"`): the figure leaves the grid and positions
 * absolutely within its section (the `.pp-section` is `position: relative`), for
 * decorative overlap / free placement. The grid `start-N/end-N` classes stay on
 * the element (harmless on an absolute box) so the selection ring still shows;
 * an inline absolute style overrides the grid row/z. A dedicated move handle
 * (not the resize handles) repositions it by writing `pinX`/`pinY` (% of the
 * section). Shuffle ignores pinned images entirely (`ignoreSelector` in
 * `Editor.tsx`), so the body still selects but never grid-drags.
 *
 * Drag wiring is a NATIVE `pointerdown` listener on each handle (not a React
 * prop): it fires in the bubble phase AT the handle — before `view.dom` — so
 * `stopPropagation()` keeps shuffle's `pointerdown` from ever grabbing the
 * block, with no dependence on the shuffle package. The handle must also be
 * `pointer-events: auto` (page-builder.css) since the figure is
 * `pointer-events: none` as an atom and children inherit it.
 */

import type { NodeViewComponentProps } from "@handlewithcare/react-prosemirror";
import { useEditorEffect } from "@handlewithcare/react-prosemirror";
import { Camera, LinkSimple } from "@phosphor-icons/react";
import type { EditorView } from "prosemirror-view";
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
} from "react";

import { widthLimits } from "../attrClassesPlugin";
import { unsplashClaimPlaceholder, unsplashOpenFill } from "../unsplashPicker";

/** Does the image carry a usable link? Mirrors the runtime's `SiteImage`
 *  gating: an action other than "none" with a real target. */
function isImageLinked(attrs: Record<string, unknown>): boolean {
  const action = (attrs["action"] as string) || "none";
  if (action === "none") return false;
  if (action === "url") return !!attrs["href"];
  if (action === "page") return !!attrs["pageId"];
  if (action === "section") return !!attrs["sectionId"];
  return action === "prevPage" || action === "nextPage";
}

/** Smallest internal width the handles allow, as a % of the footprint — our
 *  analog of pagy's 16px floor (image-resize.tsx clamps `Math.max(16, …)`). */
const MIN_WIDTH_PCT = 10;

export function ImageNodeView({
  ref,
  nodeProps,
  children,
  ...props
}: NodeViewComponentProps) {
  const { node, getPos } = nodeProps;
  const src = (node.attrs["src"] as string) || "";
  const alt = (node.attrs["alt"] as string) || "";
  const aspect = (node.attrs["aspect"] as string) || "16/9";
  const width = node.attrs["width"] as number | null;
  const linked = isImageLinked(node.attrs);
  const unsplashPending = node.attrs["unsplashPending"] === true;
  // An image with no source yet shows a clickable empty-state instead of a
  // broken `<img>` — its own affordance to open the Unsplash photo picker.
  const empty = !src;
  const injectedClass = (props as { className?: string }).className ?? "";

  const pinned = node.attrs["position"] === "pinned";
  const { minW: pinMinW, maxW: pinMaxW } = widthLimits(node.attrs);
  // Absolute placement within the section when pinned (overrides the grid
  // row/z that shuffle injected via `...props`).
  const pinStyle: CSSProperties | undefined = pinned
    ? {
        position: "absolute",
        left: `${Number(node.attrs["pinX"] ?? 50)}%`,
        top: `${Number(node.attrs["pinY"] ?? 50)}%`,
        width: `${Number(node.attrs["pinW"] ?? 40)}%`,
        ...(pinMinW > 0 ? { minWidth: `${pinMinW}px` } : {}),
        ...(pinMaxW > 0 ? { maxWidth: `${pinMaxW}px` } : {}),
        zIndex: 5,
      }
    : undefined;

  // Internal image width (a % of the footprint) lives on the MEDIA, not the
  // figure — flow mode only; pinned sizes the figure itself.
  const mediaStyle: CSSProperties | undefined =
    !pinned && width != null
      ? ({ "--pb-image-width": `${width}%` } as CSSProperties)
      : undefined;

  // The live view + a fresh getPos for the native drag handlers below.
  const viewRef = useRef<EditorView | null>(null);
  const getPosRef = useRef(getPos);
  getPosRef.current = getPos;
  useEditorEffect((view) => {
    viewRef.current = view;
  });

  // A placeholder dropped from the "Unsplash" catalog block auto-opens the
  // picker for itself, then clears the marker so a re-mount won't re-open it.
  useEffect(() => {
    if (!unsplashPending) return;
    const view = viewRef.current;
    const pos = getPosRef.current();
    if (!view || pos == null) return;
    unsplashClaimPlaceholder(pos)(view.state, view.dispatch);
  }, [unsplashPending]);

  // Click the empty-state to (re)open the picker targeting this image.
  const openPicker = (e: ReactPointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const view = viewRef.current;
    const pos = getPosRef.current();
    if (!view || pos == null) return;
    unsplashOpenFill(pos)(view.state, view.dispatch);
  };

  const leftRef = useRef<HTMLSpanElement>(null);
  const rightRef = useRef<HTMLSpanElement>(null);
  const moveRef = useRef<HTMLSpanElement>(null);

  // Resize handles (flow mode) — drag an edge to set the footprint `width`.
  useEffect(() => {
    if (pinned) return undefined;
    const attach = (el: HTMLSpanElement | null, side: "left" | "right") => {
      if (!el) return undefined;
      const onDown = (e: PointerEvent) => {
        if (e.button !== 0) return;
        // Block shuffle's block-drag (its pointerdown is on view.dom, up the
        // bubble path) and the browser's default text selection.
        e.stopPropagation();
        e.preventDefault();

        const view = viewRef.current;
        const pos = getPosRef.current();
        const figure = el.closest(".pb-image");
        const media = el.closest(".pb-image-media");
        if (
          !view ||
          pos == null ||
          !(figure instanceof HTMLElement) ||
          !(media instanceof HTMLElement)
        ) {
          return;
        }

        // Footprint = the full-width figure; the media is the current image.
        const footprintPx = figure.getBoundingClientRect().width;
        const startMediaPx = media.getBoundingClientRect().width;
        const attrs = view.state.doc.nodeAt(pos)?.attrs ?? {};
        const centered = ((attrs["align"] as string) ?? "center") === "center";
        const startX = e.pageX;
        let applied: number | null = (attrs["width"] as number | null) ?? null;

        document.body.style.userSelect = "none";

        const onMove = (ev: PointerEvent) => {
          const dx = ev.pageX - startX;
          // Left edge grows when dragged left (dx<0), right edge when dragged
          // right. Centered → both edges move, so ×2 (pagy's symmetric feel).
          const edge = side === "left" ? -dx : dx;
          const nextPx = startMediaPx + (centered ? 2 : 1) * edge;
          const pct = Math.min(
            100,
            Math.max(MIN_WIDTH_PCT, Math.round((nextPx / footprintPx) * 100)),
          );
          // Full → store `null` (pagy's `>= maxWidth ? null`): full-bleed AND
          // the Align control hides.
          const next = pct >= 100 ? null : pct;
          if (next === applied) return;
          applied = next;
          view.dispatch(
            view.state.tr.setNodeAttribute(getPosRef.current(), "width", next),
          );
        };
        const onUp = () => {
          document.body.style.userSelect = "";
          document.removeEventListener("pointermove", onMove, true);
          document.removeEventListener("pointerup", onUp, true);
        };
        document.addEventListener("pointermove", onMove, true);
        document.addEventListener("pointerup", onUp, true);
      };
      el.addEventListener("pointerdown", onDown);
      return () => el.removeEventListener("pointerdown", onDown);
    };
    const detachLeft = attach(leftRef.current, "left");
    const detachRight = attach(rightRef.current, "right");
    return () => {
      detachLeft?.();
      detachRight?.();
    };
  }, [pinned]);

  // Move handle (pinned mode) — drag to set pinX/pinY (% of the section box).
  useEffect(() => {
    if (!pinned) return undefined;
    const el = moveRef.current;
    if (!el) return undefined;
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      const view = viewRef.current;
      const pos = getPosRef.current();
      const figure = el.closest(".pb-image");
      const section = el.closest(".pp-section");
      if (
        !view ||
        pos == null ||
        !(figure instanceof HTMLElement) ||
        !(section instanceof HTMLElement)
      ) {
        return;
      }
      const rect = section.getBoundingClientRect();
      const figRect = figure.getBoundingClientRect();
      // Offset between the pointer and the figure's top-left, so the image
      // doesn't jump to the cursor on grab.
      const grabDX = e.clientX - figRect.left;
      const grabDY = e.clientY - figRect.top;
      document.body.style.userSelect = "none";

      const onMove = (ev: PointerEvent) => {
        const left = ((ev.clientX - grabDX - rect.left) / rect.width) * 100;
        const top = ((ev.clientY - grabDY - rect.top) / rect.height) * 100;
        view.dispatch(
          view.state.tr
            .setNodeAttribute(getPosRef.current(), "pinX", Math.round(left * 10) / 10)
            .setNodeAttribute(getPosRef.current(), "pinY", Math.round(top * 10) / 10),
        );
      };
      const onUp = () => {
        document.body.style.userSelect = "";
        document.removeEventListener("pointermove", onMove, true);
        document.removeEventListener("pointerup", onUp, true);
      };
      document.addEventListener("pointermove", onMove, true);
      document.addEventListener("pointerup", onUp, true);
    };
    el.addEventListener("pointerdown", onDown);
    return () => el.removeEventListener("pointerdown", onDown);
  }, [pinned]);

  return (
    <figure
      ref={ref}
      {...props}
      className={`pb-image ${injectedClass}${pinned ? " pb-image--pinned" : ""}`.trim()}
      {...(pinned ? { style: pinStyle } : {})}
      data-node-type="image"
      data-aspect={aspect}
      {...(empty ? { "data-empty": "true" } : {})}
      {...(pinned ? { "data-pinned": "true" } : {})}
      {...(linked ? { "data-linked": "true" } : {})}
    >
      <div className="pb-image-media" style={mediaStyle}>
        {empty ? (
          // No source yet: a clickable empty-state that opens the picker. No
          // resize/move handles or link badge — there's nothing to size or link.
          <button
            type="button"
            className="pb-image-empty"
            contentEditable={false}
            draggable={false}
            onPointerDown={openPicker}
            title="Choose a photo from Unsplash"
          >
            <Camera size={24} weight="thin" />
            <span>Choose a photo</span>
          </button>
        ) : (
          <>
            <img src={src} alt={alt} draggable={false} />
            {/* Authoring affordance: a corner badge so it's clear the image is a
                link (the anchor itself only activates in the runtime/preview). */}
            {linked && (
              <span
                className="pb-image-link-badge"
                contentEditable={false}
                aria-hidden="true"
              >
                <LinkSimple size={12} weight="bold" />
              </span>
            )}
            {pinned ? (
              <span
                ref={moveRef}
                className="pb-image-move-handle"
                contentEditable={false}
                aria-hidden="true"
                draggable={false}
                title="Drag to position"
              />
            ) : (
              <>
                <span
                  ref={leftRef}
                  className="pb-image-resize-handle"
                  data-side="left"
                  aria-hidden="true"
                  draggable={false}
                />
                <span
                  ref={rightRef}
                  className="pb-image-resize-handle"
                  data-side="right"
                  aria-hidden="true"
                  draggable={false}
                />
              </>
            )}
          </>
        )}
      </div>
      {/* Rich, inline-editable caption (its own node) — PM renders the
          image_caption content into this figcaption via contentDOMRef. */}
      <figcaption ref={nodeProps.contentDOMRef} className="pb-image-caption">
        {children}
      </figcaption>
    </figure>
  );
}
