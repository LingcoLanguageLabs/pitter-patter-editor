/**
 * NodeView for the `embed` schema node. Renders a `<figure>` with an
 * `<iframe>` inside. Same rationale as `VideoNodeView` for using a NodeView
 * instead of `toDOM`: shuffle decorations need to land via `{...props}`.
 *
 * Empty state mirrors the video block — a grey 16/9 placeholder with a code
 * glyph until a URL is set from the settings panel. The stored `src` is the
 * raw URL the user pasted; `toEmbedUrl` rewrites the known video providers to
 * their embeddable form (everything else passes through).
 *
 * Like the video/audio blocks, the iframe is non-interactive in the canvas
 * (`pointer-events: none` in the CSS) so clicks select the block instead of
 * being swallowed by the embedded page; it's live on the published site.
 */

import { Code } from "@phosphor-icons/react";
import type { NodeViewComponentProps } from "@handlewithcare/react-prosemirror";

import { EMBED_ALLOW, toEmbedUrl } from "../embed";

export function EmbedNodeView({
  ref,
  nodeProps,
  children: _children,
  ...props
}: NodeViewComponentProps) {
  const src = (nodeProps.node.attrs["src"] as string) || "";
  const title = (nodeProps.node.attrs["title"] as string) || "Embedded content";
  const aspect = (nodeProps.node.attrs["aspect"] as string) || "16/9";
  const injectedClass = (props as { className?: string }).className ?? "";
  return (
    <figure
      ref={ref}
      {...props}
      className={`pb-embed ${injectedClass}`.trim()}
      data-node-type="embed"
      data-aspect={aspect}
    >
      {src ? (
        <iframe
          src={toEmbedUrl(src)}
          title={title}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allow={EMBED_ALLOW}
          allowFullScreen
        />
      ) : (
        <div className="pb-media-placeholder">
          <Code size={56} weight="thin" />
        </div>
      )}
    </figure>
  );
}
