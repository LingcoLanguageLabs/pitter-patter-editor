/**
 * Labeled image — builder NodeViews. The author edits the intro inline (the
 * prompt stem) and drops markers on the image below it via `MarkerImage`.
 * `...props` MUST land on the outer element so the shuffle grid classes apply.
 *
 *   LabeledImageView       — block chrome: the intro + the markable image.
 *                            Commits marker edits to the node's `markers` attr.
 *   LabeledImagePromptView — the editable "put anything" intro stem.
 */

import {
  useEditorEventCallback,
  type NodeViewComponentProps,
} from "@handlewithcare/react-prosemirror";

import { useItemBuilderTools } from "../shared/blockTools";
import { MarkerImage } from "./MarkerImage";
import type { LabeledMarker } from "./markers";

function injectedClass(props: object): string {
  return (props as { className?: string }).className ?? "";
}

export function LabeledImageView({
  nodeProps,
  ref,
  children,
  ...props
}: NodeViewComponentProps) {
  const { node, getPos, contentDOMRef } = nodeProps;
  const a = node.attrs;
  const markers = (a["markers"] as LabeledMarker[]) ?? [];

  const setMarkers = useEditorEventCallback((view, next: LabeledMarker[]) => {
    const pos = getPos();
    if (pos == null) return;
    const fresh = view.state.doc.nodeAt(pos);
    if (!fresh) return;
    view.dispatch(
      view.state.tr.setNodeMarkup(pos, undefined, { ...fresh.attrs, markers: next }),
    );
  });

  const className = ["pp-labeled", injectedClass(props)].filter(Boolean).join(" ");
  return (
    <div ref={ref} {...props} className={className} data-node-type="labeled-image">
      <div ref={contentDOMRef} className="pp-labeled-content">
        {children}
      </div>
      <MarkerImage
        src={(a["src"] as string) || ""}
        alt={(a["alt"] as string) || ""}
        markers={markers}
        onChange={setMarkers}
      />
      <p className="pp-labeled-hint">
        {markers.length
          ? "Drag a marker to move it · click the image to add another · edit titles in settings."
          : "Click the image to add a marker, then title it in settings."}
      </p>
    </div>
  );
}

export function LabeledImagePromptView({
  nodeProps,
  ref,
  children,
  ...props
}: NodeViewComponentProps) {
  const tools = useItemBuilderTools();
  const className = ["pp-labeled-prompt-wrapper", injectedClass(props)]
    .filter(Boolean)
    .join(" ");
  return (
    <div ref={ref} {...props} className={className}>
      <div ref={nodeProps.contentDOMRef} className="pp-labeled-prompt">
        {children}
      </div>
      {tools && (
        <tools.AddContentBlock
          getContainerPos={nodeProps.getPos}
          className="pp-mc-add pp-mc-add--stem"
          label="Add to intro"
        />
      )}
    </div>
  );
}
