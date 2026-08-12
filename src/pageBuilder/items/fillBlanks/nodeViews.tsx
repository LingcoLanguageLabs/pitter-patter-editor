/**
 * Fill Blanks — builder node views.
 *
 *   FbView    — the question block: a `block+` container (same as MC's stem)
 *               that renders its blocks + a "+ Add to question" control. Authors
 *               type sentences and select text → "Mark as blank" (toolbar). In
 *               word-bank mode it also shows a static preview of the bank below
 *               the question (see WordBankPreview) so authors see what students
 *               get without leaving for Preview mode.
 *   BlankView — an inline atom rendered as a selectable chip. Selecting it shows
 *               the blank settings popover (see BlankSettingsPopover), the same
 *               selection-driven pattern as the block menu.
 */

import { type NodeViewComponentProps } from "@handlewithcare/react-prosemirror";
import { CaretDown } from "@phosphor-icons/react";
import type { Node as PmNode } from "prosemirror-model";

import { useItemBuilderTools } from "../shared/blockTools";
import { BLANK_NODE, type BlankOption } from "./schema";

function injectedClass(props: object): string {
  return (props as { className?: string }).className ?? "";
}

export function FbView({
  nodeProps,
  ref,
  children,
  ...props
}: NodeViewComponentProps) {
  const tools = useItemBuilderTools();
  const wordBank = !!nodeProps.node.attrs["wordBank"];
  const bankTop = nodeProps.node.attrs["bankPosition"] !== "bottom";
  const className = ["pp-fb", injectedClass(props)].filter(Boolean).join(" ");
  // Authoring preview of the bank — chrome, not editable content, so it sits
  // OUTSIDE the contentDOM. Re-derived on every render, so it tracks blanks
  // added/removed and answer edits live. Placed above/below to match position.
  const bankPreview = wordBank ? <WordBankPreview node={nodeProps.node} /> : null;
  return (
    <div ref={ref} {...props} className={className}>
      {bankTop && bankPreview}
      <div ref={nodeProps.contentDOMRef} className="pp-fb-content">
        {children}
      </div>
      {!bankTop && bankPreview}
      {tools && (
        <tools.AddContentBlock
          getContainerPos={nodeProps.getPos}
          className="pp-fb-add"
          label="Add to question"
        />
      )}
    </div>
  );
}

/** Answer words for the word-bank preview, in document order — mirrors the
 *  completer's bank (one word per blank, document order, no shuffle). */
function blankAnswers(node: PmNode): string[] {
  const words: string[] = [];
  node.descendants((child) => {
    if (child.type.name !== BLANK_NODE) return true;
    const options = (child.attrs["options"] as BlankOption[]) ?? [];
    const answerId = child.attrs["answerId"] as string;
    const answer = options.find((o) => o.id === answerId)?.text ?? "";
    if (answer) words.push(answer);
    return false; // blanks are atoms — nothing to descend into
  });
  return words;
}

/** Static (non-interactive) mirror of the completer's `.pp-fb-bank`, shown in
 *  the builder when word-bank mode is on so the author sees the bank students
 *  will drag from. Reuses the completer's classes so the look matches exactly.
 *  Answer words + distractors, shown in a stable order (the live bank shuffles).
 *  Distractors carry a marker so the author can tell them apart while editing —
 *  students see no such distinction. */
function WordBankPreview({ node }: { node: PmNode }) {
  const answers = blankAnswers(node);
  const distractors = ((node.attrs["bankDistractors"] as string[]) ?? []).filter(
    (w) => w.trim(),
  );
  const hasAny = answers.length > 0 || distractors.length > 0;
  return (
    <div
      className="pp-fb-bank pp-fb-bank--preview"
      contentEditable={false}
      suppressContentEditableWarning
    >
      <span className="pp-fb-bank-label">Word bank</span>
      <div className="pp-fb-bank-words">
        {hasAny ? (
          <>
            {answers.map((w, i) => (
              <span key={`a-${i}`} className="pp-fb-word pp-fb-word--static">
                {w}
              </span>
            ))}
            {distractors.map((w, i) => (
              <span
                key={`d-${i}`}
                className="pp-fb-word pp-fb-word--static pp-fb-word--distractor"
                title="Distractor"
              >
                {w}
              </span>
            ))}
          </>
        ) : (
          <span className="pp-fb-bank-empty">
            Mark words as blanks to build the bank
          </span>
        )}
      </div>
    </div>
  );
}

export function BlankView({ nodeProps, ref, ...props }: NodeViewComponentProps) {
  const { node } = nodeProps;
  const mode = node.attrs["mode"] as string;
  const options = (node.attrs["options"] as BlankOption[]) ?? [];
  const answerId = node.attrs["answerId"] as string;
  const answer = options.find((o) => o.id === answerId)?.text ?? "";

  // The chip IS the node DOM. Selecting it (a NodeSelection) is what surfaces
  // the settings popover — handled by BlankSettingsPopover, not here.
  const className = ["pp-blank-chip", injectedClass(props)]
    .filter(Boolean)
    .join(" ");
  return (
    <span
      ref={ref}
      {...props}
      className={className}
      data-mode={mode}
      contentEditable={false}
      suppressContentEditableWarning
    >
      <span className="pp-blank-chip-text">{answer || "blank"}</span>
      {mode === "dropdown" && <CaretDown size={11} weight="bold" />}
    </span>
  );
}
