/**
 * NodeView for the `video` schema node. Renders a `<figure>` with a
 * `<video>` inside. Same rationale as `ButtonNodeView` for using a
 * NodeView instead of `toDOM`: shuffle decorations need to land via
 * `{...props}`.
 *
 * Empty state mirrors pagy's video block (`render-block.tsx`): when
 * there's no source we render a grey 16/9 placeholder with a film-strip
 * glyph instead of a bare `<video>` (which would otherwise show a tiny
 * intrinsic-size black box). The source is set from the settings panel.
 *
 * When a source is set, the player chrome renders (so the block previews
 * faithfully) but is non-interactive in the canvas — `pointer-events:
 * none` in the CSS — so clicks select the block instead of hitting the
 * controls. Playback lives in the settings panel preview / published page.
 */

import { FilmStrip } from "@phosphor-icons/react";
import type { NodeViewComponentProps } from "@handlewithcare/react-prosemirror";

export function VideoNodeView({
  ref,
  nodeProps,
  children: _children,
  ...props
}: NodeViewComponentProps) {
  const src = (nodeProps.node.attrs["src"] as string) || "";
  const poster = (nodeProps.node.attrs["poster"] as string) || "";
  const controls = !!nodeProps.node.attrs["controls"];
  const autoplay = !!nodeProps.node.attrs["autoplay"];
  const muted = !!nodeProps.node.attrs["muted"];
  const loop = !!nodeProps.node.attrs["loop"];
  const injectedClass = (props as { className?: string }).className ?? "";
  return (
    <figure
      ref={ref}
      {...props}
      className={`pb-video ${injectedClass}`.trim()}
      data-node-type="video"
    >
      {src ? (
        <video
          src={src}
          poster={poster || undefined}
          controls={controls}
          autoPlay={autoplay}
          // Browsers only honour autoplay when muted, and the canvas
          // shouldn't make noise regardless — so autoplay implies muted.
          muted={muted || autoplay}
          loop={loop}
          playsInline
          preload="metadata"
        />
      ) : (
        <div className="pb-media-placeholder">
          <FilmStrip size={64} weight="thin" />
        </div>
      )}
    </figure>
  );
}
