/**
 * Multiple Choice — builder NodeViews. Inline-editable inside the one
 * ProseMirror doc: the author tabs/arrows between the prompt and each option
 * like normal text — no nested editors. Shuffle drags/resizes the whole `mc`
 * block. `...props` MUST be spread onto the outer element of each view so the
 * shuffle grid classes (`start-N end-N`) it decorates land on the DOM.
 *
 *   McView       — block chrome + content DOM (prompt + options) + "Add option".
 *                  Provides {@link McContext} so each option reads the parent's
 *                  mode/layout WITHOUT subscribing to the whole editor state.
 *   McPromptView — the editable prompt text.
 *   McOptionView — a radio/checkbox to mark correct + editable text + delete.
 *
 * PERF: options must NOT call `useEditorState()` — that subscribes every option
 * to *every* transaction (incl. hover-decoration churn), so a page of image
 * cards re-renders all of them on each mouse-move. Instead the parent's attrs
 * flow down via context (changes only when the `mc` node changes), and the
 * heavy photo is an isolated `React.memo` layer that only re-renders when its
 * URL changes — so hovering never repaints the images.
 */

import {
  useEditorEventCallback,
  type NodeViewComponentProps,
} from "@handlewithcare/react-prosemirror";
import { Image as ImageIcon, Trash } from "@phosphor-icons/react";
import type { Node as PmNode } from "prosemirror-model";
import { createContext, memo, useContext, useMemo, type ChangeEvent } from "react";

import { useItemBuilderTools } from "../shared/blockTools";
import { newId } from "../shared/ids";
import { MC_OPTION_NODE } from "./schema";

/** Parent `mc` attrs an option needs, passed down so options don't subscribe to
 *  global editor state. The value changes only when the `mc` node changes. */
interface McCtx {
  multiple: boolean;
  completion: boolean;
  gridLayout: boolean;
  optionCount: number;
}
const McContext = createContext<McCtx>({
  multiple: false,
  completion: false,
  gridLayout: false,
  optionCount: 1,
});

function injectedClass(props: object): string {
  return (props as { className?: string }).className ?? "";
}

/** The option's photo as an isolated, memoized layer — re-renders ONLY when the
 *  URL changes, so an option re-render (or a hover decoration landing on the
 *  card) never re-applies/repaints the (possibly large) background image. */
const OptionCardImage = memo(function OptionCardImage({ image }: { image: string }) {
  if (!image) return null;
  return (
    <div
      className="pp-mc-option-bg"
      aria-hidden
      style={{ backgroundImage: `url(${JSON.stringify(image)})` }}
    />
  );
});

export function McView({
  nodeProps,
  ref,
  children,
  ...props
}: NodeViewComponentProps) {
  const { node, getPos, contentDOMRef } = nodeProps;

  const addOption = useEditorEventCallback((view) => {
    if (!view) return;
    const pos = getPos();
    if (pos == null) return;
    const optionType = view.state.schema.nodes[MC_OPTION_NODE];
    if (!optionType) return;
    // Insert just before the block's closing token.
    const endOfContent = pos + node.nodeSize - 1;
    const newOption = optionType.create({ optionId: newId("opt"), correct: false });
    view.dispatch(view.state.tr.insert(endOfContent, newOption).scrollIntoView());
  });

  const multiple = !!node.attrs["multiple"];
  const completion = node.attrs["scoringMode"] === "completion";
  const gridLayout = node.attrs["layout"] === "grid";
  let optionCount = 0;
  node.forEach((c) => {
    if (c.type.name === MC_OPTION_NODE) optionCount += 1;
  });
  const ctx = useMemo<McCtx>(
    () => ({ multiple, completion, gridLayout, optionCount }),
    [multiple, completion, gridLayout, optionCount],
  );

  const className = ["pp-mc", injectedClass(props)].filter(Boolean).join(" ");

  return (
    <div ref={ref} {...props} className={className} data-layout={gridLayout ? "grid" : undefined}>
      {/* No baked-in label/background — the block reads as plain content; its
          identity comes from the shuffle handle pill + the block menu. Mode +
          points live in the block menu (SettingsForm). */}
      <McContext.Provider value={ctx}>
        <div ref={contentDOMRef} className="pp-mc-content">
          {children}
        </div>
      </McContext.Provider>
      <button
        type="button"
        contentEditable={false}
        onMouseDown={(e) => e.preventDefault()}
        onClick={addOption}
        className="pp-mc-add"
      >
        + Add option
      </button>
    </div>
  );
}

export function McPromptView({
  nodeProps,
  ref,
  children,
  ...props
}: NodeViewComponentProps) {
  // The stem is a block container: it renders its child blocks (a paragraph by
  // default) and offers "+ Add to question" so the author can drop in images,
  // audio, headings, etc. The add control is injected by the page builder
  // (items can't import the block catalog/factory — see blockTools).
  const tools = useItemBuilderTools();
  const className = ["pp-mc-prompt-wrapper", injectedClass(props)]
    .filter(Boolean)
    .join(" ");
  return (
    <div ref={ref} {...props} className={className}>
      <div ref={nodeProps.contentDOMRef} className="pp-mc-prompt">
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

export function McOptionView({
  nodeProps,
  ref,
  children,
  ...props
}: NodeViewComponentProps) {
  const { node, getPos } = nodeProps;
  const correct = !!node.attrs["correct"];
  const image = (node.attrs["image"] as string) || "";

  // Parent attrs via context (no `useEditorState` — see file header). This
  // re-renders the option only when the `mc` node's mode/layout/count changes,
  // never on hover/selection transactions.
  const { multiple, completion, gridLayout, optionCount } = useContext(McContext);
  const canDelete = optionCount > 1;

  const setImage = useEditorEventCallback((view, url: string) => {
    const p = getPos();
    if (!view || p == null) return;
    const fresh = view.state.doc.nodeAt(p);
    if (!fresh) return;
    view.dispatch(
      view.state.tr.setNodeMarkup(p, undefined, { ...fresh.attrs, image: url }),
    );
  });
  const onImageFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result || ""));
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const pickCorrect = useEditorEventCallback((view) => {
    if (!view) return;
    const p = getPos();
    if (p == null) return;
    const $pos = view.state.doc.resolve(p);
    const parent = $pos.parent;
    const parentStart = $pos.start();
    const isMultiple = !!parent.attrs["multiple"];
    let tr = view.state.tr;
    if (isMultiple) {
      // Multi-select: toggle just this option.
      tr = tr.setNodeMarkup(p, undefined, { ...node.attrs, correct: !correct });
    } else {
      // Single-select: this one true, every sibling false.
      parent.forEach((child: PmNode, offset: number) => {
        if (child.type.name !== MC_OPTION_NODE) return;
        const childPos = parentStart + offset;
        const want = childPos === p;
        if (child.attrs["correct"] !== want) {
          tr = tr.setNodeMarkup(childPos, undefined, {
            ...child.attrs,
            correct: want,
          });
        }
      });
    }
    if (tr.docChanged) view.dispatch(tr);
  });

  const deleteOption = useEditorEventCallback((view) => {
    if (!view) return;
    const p = getPos();
    if (p == null) return;
    const $pos = view.state.doc.resolve(p);
    let count = 0;
    $pos.parent.forEach((c: PmNode) => {
      if (c.type.name === MC_OPTION_NODE) count += 1;
    });
    if (count <= 1) return; // schema needs ≥1 option
    view.dispatch(view.state.tr.delete(p, p + node.nodeSize));
  });

  const className = [
    "pp-mc-option",
    correct ? "pp-mc-option--correct" : "",
    injectedClass(props),
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={ref} {...props} className={className}>
      {gridLayout && <OptionCardImage image={image} />}
      {/* Completion (opinion-poll) mode has no answer key, so the
          mark-as-correct control is hidden — options are just choices. */}
      {!completion && (
        <input
          type={multiple ? "checkbox" : "radio"}
          checked={correct}
          onChange={pickCorrect}
          onMouseDown={(e) => e.preventDefault()}
          contentEditable={false}
          className="pp-mc-option-mark"
          aria-label="Mark as correct answer"
        />
      )}
      <div ref={nodeProps.contentDOMRef} className="pp-mc-option-text">
        {children}
      </div>
      {gridLayout && (
        <label
          className="pp-mc-option-image"
          contentEditable={false}
          onMouseDown={(e) => e.preventDefault()}
          title={image ? "Replace image" : "Add image"}
        >
          <ImageIcon size={14} weight="bold" />
          <input type="file" accept="image/*" hidden onChange={onImageFile} />
        </label>
      )}
      <button
        type="button"
        contentEditable={false}
        onMouseDown={(e) => e.preventDefault()}
        onClick={deleteOption}
        disabled={!canDelete}
        className="pp-mc-option-delete"
        aria-label="Delete option"
        title={canDelete ? "Delete option" : "A question needs at least one option"}
      >
        <Trash size={14} weight="bold" />
      </button>
    </div>
  );
}
