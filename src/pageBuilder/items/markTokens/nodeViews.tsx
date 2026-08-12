/**
 * Mark the Words — builder NodeViews. Authored inline in the one ProseMirror doc
 * (no nested editors); shuffle drags/resizes the whole `mt` block. `...props`
 * MUST be spread onto each view's outer element so the shuffle grid classes land.
 *
 *   MtView       — block chrome: the content DOM (prompt stem + markable text).
 *   MtPromptView — the editable "put anything" stem (+ "Add to question"), the
 *                  same component shape as MC's prompt view.
 *   MtTextView   — the markable text region. Authors type the sentence and select
 *                  words → "Mark target" (toolbar); marked words highlight via the
 *                  `mttoken` mark so the answer key is visible while authoring. A
 *                  small label explains the gesture.
 */

import { type NodeViewComponentProps } from "@handlewithcare/react-prosemirror";

import { useItemBuilderTools } from "../shared/blockTools";

function injectedClass(props: object): string {
  return (props as { className?: string }).className ?? "";
}

export function MtView({ ref, children, ...props }: NodeViewComponentProps) {
  const className = ["pp-mt", injectedClass(props)].filter(Boolean).join(" ");
  // No baked-in label/background — identity comes from the shuffle handle pill +
  // the block menu; points live in the SettingsForm. The content DOM holds the
  // prompt stem then the markable text (the schema's fixed `mt_prompt mt_text`).
  return (
    <div ref={ref} {...props} className={className}>
      {children}
    </div>
  );
}

export function MtPromptView({
  nodeProps,
  ref,
  children,
  ...props
}: NodeViewComponentProps) {
  // The stem is a block container: renders its child blocks (a paragraph by
  // default) and offers "+ Add to question" so the author can drop in images,
  // audio, etc. The add control is injected by the page builder (items can't
  // import the block catalog/factory — see blockTools).
  const tools = useItemBuilderTools();
  const className = ["pp-mt-prompt-wrapper", injectedClass(props)]
    .filter(Boolean)
    .join(" ");
  return (
    <div ref={ref} {...props} className={className}>
      <div ref={nodeProps.contentDOMRef} className="pp-mt-prompt">
        {children}
      </div>
      {tools && (
        <tools.AddContentBlock
          getContainerPos={nodeProps.getPos}
          className="pp-mt-add pp-mt-add--stem"
          label="Add to question"
        />
      )}
    </div>
  );
}

export function MtTextView({
  nodeProps,
  ref,
  children,
  ...props
}: NodeViewComponentProps) {
  const className = ["pp-mt-text-wrapper", injectedClass(props)]
    .filter(Boolean)
    .join(" ");
  return (
    <div ref={ref} {...props} className={className}>
      {/* Chrome, not editable content — sits outside the contentDOM. */}
      <span className="pp-mt-text-label" contentEditable={false}>
        Markable text — select words, then “Mark target”
      </span>
      <div ref={nodeProps.contentDOMRef} className="pp-mt-text">
        {children}
      </div>
    </div>
  );
}
