/**
 * Text Prompt — builder NodeViews. Inline-editable inside the one ProseMirror
 * doc: the author edits the question stem like normal text; shuffle drags /
 * resizes the whole `text_prompt` block. `...props` MUST be spread onto each
 * view's outer element so the shuffle grid classes land on the DOM.
 *
 *   TextPromptView     — the stem content DOM + a PREVIEW of the answer field
 *                        (the real, interactive one lives in the completer).
 *   TextPromptStemView — the editable question stem + "+ Add to question".
 *
 * The preview field is `readOnly` (it's a preview, not for the author to answer)
 * but the `long` textarea keeps its resize handle so the resizing affordance is
 * visible here too. Mode + placeholder live in the block menu (variant) and the
 * Attributes section (placeholder).
 */

import { type NodeViewComponentProps } from "@handlewithcare/react-prosemirror";

import { useItemBuilderTools } from "../shared/blockTools";
import { TEXT_PROMPT_DEFAULT_PLACEHOLDER } from "./schema";

function injectedClass(props: object): string {
  return (props as { className?: string }).className ?? "";
}

export function TextPromptView({
  nodeProps,
  ref,
  children,
  ...props
}: NodeViewComponentProps) {
  const { node, contentDOMRef } = nodeProps;
  const variant = node.attrs["variant"] === "long" ? "long" : "short";
  const fieldWidth =
    node.attrs["fieldWidth"] === "compact" ? "compact" : "fill";
  const placeholder =
    (node.attrs["placeholder"] as string) || TEXT_PROMPT_DEFAULT_PLACEHOLDER;

  const className = ["pp-text-prompt", injectedClass(props)]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={ref} {...props} className={className}>
      {/* No baked-in label/background — identity comes from the shuffle handle
          pill + the block menu. The stem (text_prompt_stem) renders here. */}
      <div ref={contentDOMRef} className="pp-text-prompt-content">
        {children}
      </div>
      {/* Answer-field preview — what the student will see, inert in the builder.
          `contentEditable={false}` keeps it out of the PM document. */}
      <div className="pp-text-prompt-field" contentEditable={false}>
        {variant === "long" ? (
          <textarea
            className="pp-text-prompt-input -long"
            placeholder={placeholder}
            rows={4}
            readOnly
            tabIndex={-1}
            aria-label="Answer (preview)"
          />
        ) : (
          <input
            type="text"
            className={`pp-text-prompt-input -short -${fieldWidth}`}
            placeholder={placeholder}
            readOnly
            tabIndex={-1}
            aria-label="Answer (preview)"
          />
        )}
      </div>
    </div>
  );
}

export function TextPromptStemView({
  nodeProps,
  ref,
  children,
  ...props
}: NodeViewComponentProps) {
  // The stem is a block container: it renders its child blocks (a paragraph by
  // default) and offers "+ Add to question" so the author can drop in images,
  // audio, headings, etc. The add control is injected by the page builder (items
  // can't import the block catalog/factory — see blockTools).
  const tools = useItemBuilderTools();
  const className = ["pp-text-prompt-stem-wrapper", injectedClass(props)]
    .filter(Boolean)
    .join(" ");
  return (
    <div ref={ref} {...props} className={className}>
      <div ref={nodeProps.contentDOMRef} className="pp-text-prompt-stem">
        {children}
      </div>
      {tools && (
        <tools.AddContentBlock
          getContainerPos={nodeProps.getPos}
          className="pp-text-prompt-add pp-text-prompt-add--stem"
          label="Add to question"
        />
      )}
    </div>
  );
}
