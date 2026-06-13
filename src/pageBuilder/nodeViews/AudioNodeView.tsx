/**
 * NodeView for the `audio` schema node. Renders a `<figure>` with an
 * `<audio>` inside. Same rationale as `ButtonNodeView` for using a
 * NodeView instead of `toDOM`: shuffle decorations need to land via
 * `{...props}`.
 *
 * Controls are always on — an audio element without them has no box at
 * all — but, like the video block, they're non-interactive in the
 * canvas (`pointer-events: none` in the CSS) so clicks select the
 * block. The settings panel preview is where playback happens.
 */

import type { NodeViewComponentProps } from "@handlewithcare/react-prosemirror";

export function AudioNodeView({
  ref,
  nodeProps,
  children: _children,
  ...props
}: NodeViewComponentProps) {
  const src = (nodeProps.node.attrs["src"] as string) || "";
  const injectedClass = (props as { className?: string }).className ?? "";
  return (
    <figure
      ref={ref}
      {...props}
      className={`pb-audio ${injectedClass}`.trim()}
      data-node-type="audio"
    >
      <audio src={src || undefined} controls preload="metadata" />
    </figure>
  );
}
