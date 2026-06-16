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
 * Drag wiring is a NATIVE `pointerdown` listener on each handle (not a React
 * prop): it fires in the bubble phase AT the handle — before `view.dom` — so
 * `stopPropagation()` keeps shuffle's `pointerdown` from ever grabbing the
 * block, with no dependence on the shuffle package. The handle must also be
 * `pointer-events: auto` (page-builder.css) since the figure is
 * `pointer-events: none` as an atom and children inherit it.
 */

import type { NodeViewComponentProps } from "@handlewithcare/react-prosemirror";
import { useEditorEffect } from "@handlewithcare/react-prosemirror";
import type { EditorView } from "prosemirror-view";
import { type CSSProperties, useEffect, useRef } from "react";

/** Smallest internal width the handles allow, as a % of the footprint — our
 *  analog of pagy's 16px floor (image-resize.tsx clamps `Math.max(16, …)`). */
const MIN_WIDTH_PCT = 10;

export function ImageNodeView({
  ref,
  nodeProps,
  children: _children,
  ...props
}: NodeViewComponentProps) {
  const { node, getPos } = nodeProps;
  const src = (node.attrs["src"] as string) || "";
  const alt = (node.attrs["alt"] as string) || "";
  const aspect = (node.attrs["aspect"] as string) || "16/9";
  const width = node.attrs["width"] as number | null;
  const injectedClass = (props as { className?: string }).className ?? "";
  // Internal image width (a % of the footprint) lives on the MEDIA, not the
  // figure: the figure must stay full-width so the ring spans the footprint.
  // `.pb-image-media` reads it with a `100%` fallback, so `null` (full) needs
  // none. The `pp-align-*` placement class is on the figure (via
  // `attrClassesPlugin`) and positions the media through a descendant rule.
  const mediaStyle: CSSProperties | undefined =
    width != null
      ? ({ "--pb-image-width": `${width}%` } as CSSProperties)
      : undefined;

  // The live view + a fresh getPos for the native drag handlers below.
  const viewRef = useRef<EditorView | null>(null);
  const getPosRef = useRef(getPos);
  getPosRef.current = getPos;
  useEditorEffect((view) => {
    viewRef.current = view;
  });

  const leftRef = useRef<HTMLSpanElement>(null);
  const rightRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
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
  }, []);

  return (
    <figure
      ref={ref}
      {...props}
      className={`pb-image ${injectedClass}`.trim()}
      data-node-type="image"
      data-aspect={aspect}
    >
      <div className="pb-image-media" style={mediaStyle}>
        <img src={src} alt={alt} draggable={false} />
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
      </div>
    </figure>
  );
}
