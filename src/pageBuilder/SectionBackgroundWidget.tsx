/**
 * Background media layer for a section — pagy's `section_image` /
 * section video, plus the `section_overlay` scrim.
 *
 * Rendered as a PM widget decoration (by `sectionChromePlugin`, same
 * as the chrome) rather than a raw child in `SectionNodeView`: a
 * non-PM element inside the section's contentDOM would confuse
 * shuffle's `posAtCoords` drop math, while widgets stay opaque to it.
 *
 * The layer is `position: absolute; inset: 0; pointer-events: none`,
 * sitting under the content (blocks get `position: relative` so they
 * paint above it — see page-builder.css).
 */

"use client";

import {
  useEditorState,
  type WidgetViewComponentProps,
} from "@handlewithcare/react-prosemirror";
import { forwardRef } from "react";

import { findEnclosingSection } from "./sectionUtils";

export const SectionBackgroundWidget = forwardRef<
  HTMLDivElement,
  WidgetViewComponentProps
>(function SectionBackgroundWidget({ getPos, widget: _widget, ...rest }, ref) {
  const editorState = useEditorState();
  const attrs =
    findEnclosingSection(editorState, getPos())?.node.attrs ?? {};
  const background = (attrs["background"] as string) || "solid";
  const image = (attrs["image"] as string) || "";
  const video = (attrs["video"] as string) || "";
  const overlay = (attrs["overlay"] as string) || "";
  const media =
    background === "image" ? image : background === "video" ? video : "";

  return (
    <div
      ref={ref}
      {...rest}
      className="pp-section-media"
      contentEditable={false}
      data-empty={!media || undefined}
    >
      {background === "image" && image && <img src={image} alt="" />}
      {background === "video" && video && (
        // Mirrors pagy's section video: autoplaying, looping, muted.
        <video src={video} autoPlay loop muted playsInline />
      )}
      {media && overlay && (
        <div className="pp-section-media-overlay" data-overlay={overlay} />
      )}
    </div>
  );
});
