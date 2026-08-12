/**
 * Hotspot — builder NodeViews. The author edits the instruction inline (the
 * prompt stem) and marks the image below it via `DrawableImage`. `...props` MUST
 * land on the outer element so the shuffle grid classes apply.
 *
 *   HotspotView       — block chrome: the prompt + the drawable image. Commits
 *                       region edits to the node's `regions` attr.
 *   HotspotPromptView — the editable "put anything" stem (+ "Add to question").
 */

import {
  useEditorEventCallback,
  type NodeViewComponentProps,
} from "@handlewithcare/react-prosemirror";

import { useItemBuilderTools } from "../shared/blockTools";
import { DrawableImage } from "./DrawableImage";
import type { HotspotRegion } from "./regions";

function injectedClass(props: object): string {
  return (props as { className?: string }).className ?? "";
}

export function HotspotView({
  nodeProps,
  ref,
  children,
  ...props
}: NodeViewComponentProps) {
  const { node, getPos, contentDOMRef } = nodeProps;
  const a = node.attrs;

  const setRegions = useEditorEventCallback((view, regions: HotspotRegion[]) => {
    const pos = getPos();
    if (pos == null) return;
    const fresh = view.state.doc.nodeAt(pos);
    if (!fresh) return;
    view.dispatch(
      view.state.tr.setNodeMarkup(pos, undefined, { ...fresh.attrs, regions }),
    );
  });

  const className = ["pp-hotspot", injectedClass(props)]
    .filter(Boolean)
    .join(" ");
  return (
    <div ref={ref} {...props} className={className} data-node-type="hotspot">
      <div ref={contentDOMRef} className="pp-hotspot-content">
        {children}
      </div>
      <DrawableImage
        src={(a["src"] as string) || ""}
        alt={(a["alt"] as string) || ""}
        regions={(a["regions"] as HotspotRegion[]) ?? []}
        mode={a["mode"] === "find" ? "find" : "select"}
        onChange={setRegions}
      />
    </div>
  );
}

export function HotspotPromptView({
  nodeProps,
  ref,
  children,
  ...props
}: NodeViewComponentProps) {
  const tools = useItemBuilderTools();
  const className = ["pp-hotspot-prompt-wrapper", injectedClass(props)]
    .filter(Boolean)
    .join(" ");
  return (
    <div ref={ref} {...props} className={className}>
      <div ref={nodeProps.contentDOMRef} className="pp-hotspot-prompt">
        {children}
      </div>
      {tools && (
        <tools.AddContentBlock
          getContainerPos={nodeProps.getPos}
          className="pp-mc-add pp-mc-add--stem"
          label="Add to question"
        />
      )}
    </div>
  );
}
