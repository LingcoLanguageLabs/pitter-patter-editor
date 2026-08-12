/**
 * Audio Prompt — builder NodeViews. Inline-editable inside the one ProseMirror
 * doc: the author edits the question stem like normal text; shuffle drags /
 * resizes the whole `audio_prompt` block. `...props` MUST be spread onto each
 * view's outer element so the shuffle grid classes land on the DOM.
 *
 *   AudioPromptView     — the stem content DOM + a static PREVIEW of the recorder
 *                         controls (the real, mic-backed recorder lives in the
 *                         completer / site renderer — we don't prompt for mic
 *                         access during authoring).
 *   AudioPromptStemView — the editable question stem + "+ Add to question".
 */

import { type NodeViewComponentProps } from "@handlewithcare/react-prosemirror";
import { Microphone, UploadSimple } from "@phosphor-icons/react";

import { useItemBuilderTools } from "../shared/blockTools";

function injectedClass(props: object): string {
  return (props as { className?: string }).className ?? "";
}

export function AudioPromptView({
  nodeProps,
  ref,
  children,
  ...props
}: NodeViewComponentProps) {
  const { node, contentDOMRef } = nodeProps;
  const allowUpload = !!node.attrs["allowUpload"];

  const className = ["pp-audio-prompt", injectedClass(props)]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={ref} {...props} className={className}>
      <div ref={contentDOMRef} className="pp-audio-prompt-content">
        {children}
      </div>
      {/* Recorder preview — what the student will see, inert in the builder.
          `contentEditable={false}` keeps it out of the PM document. */}
      <div className="pp-audio-prompt-recorder" contentEditable={false}>
        <span className="pp-audio-prompt-btn" aria-disabled>
          <Microphone size={16} weight="fill" /> Record
        </span>
        {allowUpload && (
          <span className="pp-audio-prompt-btn -upload" aria-disabled>
            <UploadSimple size={16} /> Upload
          </span>
        )}
      </div>
    </div>
  );
}

export function AudioPromptStemView({
  nodeProps,
  ref,
  children,
  ...props
}: NodeViewComponentProps) {
  // The stem is a block container: it renders its child blocks (a paragraph by
  // default) and offers "+ Add to question" so the author can drop in images,
  // audio, headings, etc. The add control is injected by the page builder.
  const tools = useItemBuilderTools();
  const className = ["pp-audio-prompt-stem-wrapper", injectedClass(props)]
    .filter(Boolean)
    .join(" ");
  return (
    <div ref={ref} {...props} className={className}>
      <div ref={nodeProps.contentDOMRef} className="pp-audio-prompt-stem">
        {children}
      </div>
      {tools && (
        <tools.AddContentBlock
          getContainerPos={nodeProps.getPos}
          className="pp-audio-prompt-add pp-audio-prompt-add--stem"
          label="Add to question"
        />
      )}
    </div>
  );
}
