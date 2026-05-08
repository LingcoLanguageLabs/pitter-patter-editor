/**
 * Fill-in-the-blank item — a story-scoped extension.
 *
 * Schema:
 *   cloze              — block container (rounded white box, draggable)
 *     cloze_prompt     — editable text where blanks can live
 *
 *   blank (mark)       — green-tinted highlight applied to ranges of
 *                        text inside a cloze_prompt. Toggling is gated
 *                        to that node — selecting elsewhere in the doc
 *                        does nothing.
 *
 * UX: highlight text inside a cloze prompt → bubble appears →
 * "Mark as blank" (or ⌘⇧⌫) → range gets the green styling. Selecting
 * an existing blank and triggering again removes it.
 */

import {
  useEditorEventCallback,
  useEditorState,
  type NodeViewComponentProps,
} from "@handlewithcare/react-prosemirror";
import { keymap } from "prosemirror-keymap";
import type {
  MarkSpec,
  Node as PmNode,
  NodeSpec,
  Schema,
} from "prosemirror-model";
import { Schema as PMSchema } from "prosemirror-model";
import type { Command, EditorState } from "prosemirror-state";

import { FloatingMenu } from "../editor/menu/FloatingMenu";

// ─────────────────────────────────────────────────── Schema

export const clozeSpec: NodeSpec = {
  group: "block",
  content: "cloze_prompt",
  defining: true,
  isolating: true,
  draggable: true,
  parseDOM: [{ tag: 'div[data-type="cloze"]' }],
  toDOM: () => ["div", { "data-type": "cloze", class: "pp-item pp-cloze" }, 0],
};

export const clozePromptSpec: NodeSpec = {
  content: "inline*",
  defining: true,
  parseDOM: [{ tag: 'div[data-type="cloze-prompt"]' }],
  toDOM: () => [
    "div",
    { "data-type": "cloze-prompt", class: "pp-cloze-prompt" },
    0,
  ],
};

export const blankSpec: MarkSpec = {
  parseDOM: [{ tag: "mark[data-type=blank]" }],
  toDOM: () => ["mark", { "data-type": "blank", class: "pp-blank" }, 0],
};

/** Append cloze nodes + blank mark to a schema. */
export function addClozeToSchema(schema: Schema): Schema {
  const nodes = schema.spec.nodes.append({
    cloze: clozeSpec,
    cloze_prompt: clozePromptSpec,
  });
  const marks = schema.spec.marks.append({ blank: blankSpec });
  return new PMSchema({ nodes, marks });
}

// ─────────────────────────────────────────────────── Doc helpers

/** Build a cloze item from a list of plain-text and {blank} segments. */
export function buildCloze(
  schema: Schema,
  segments: ReadonlyArray<string | { blank: string }>,
  shuffleAttrs?: { shuffleStart?: number; shuffleEnd?: number },
): PmNode {
  const promptType = schema.nodes["cloze_prompt"];
  const clozeType = schema.nodes["cloze"];
  const blankMarkType = schema.marks["blank"];
  if (!promptType || !clozeType || !blankMarkType) {
    throw new Error(
      "Cloze schema not installed. Call addClozeToSchema(schema) first.",
    );
  }
  const blankMark = blankMarkType.create();
  const inlines = segments
    .filter((s) => (typeof s === "string" ? s.length > 0 : !!s.blank))
    .map((s) =>
      typeof s === "string"
        ? schema.text(s)
        : schema.text(s.blank, [blankMark]),
    );
  const promptNode = promptType.create(null, inlines);
  return clozeType.create(shuffleAttrs ?? null, [promptNode]);
}

// ─────────────────────────────────────────────────── Selection gating

/** True iff the entire selection sits inside a single cloze_prompt. */
function isSelectionInClozePrompt(state: EditorState): boolean {
  const promptType = state.schema.nodes["cloze_prompt"];
  if (!promptType) return false;
  const { $from, $to } = state.selection;
  // Find the nearest ancestor node of type cloze_prompt for both ends.
  const inPrompt = ($pos: typeof $from) => {
    for (let d = $pos.depth; d > 0; d--) {
      if ($pos.node(d).type === promptType) return d;
    }
    return -1;
  };
  const fromDepth = inPrompt($from);
  if (fromDepth < 0) return false;
  // Selection must be within the same prompt for both ends.
  return inPrompt($to) === fromDepth;
}

// ─────────────────────────────────────────────────── Command + keymap

export const toggleBlank: Command = (state, dispatch) => {
  const blankType = state.schema.marks["blank"];
  if (!blankType) return false;
  if (!isSelectionInClozePrompt(state)) return false;
  const { from, to, empty } = state.selection;
  if (empty || from === to) return false;
  const has = state.doc.rangeHasMark(from, to, blankType);
  if (dispatch) {
    const tr = state.tr;
    if (has) tr.removeMark(from, to, blankType);
    else tr.addMark(from, to, blankType.create());
    dispatch(tr);
  }
  return true;
};

/** Keymap plugin: ⌘⇧⌫ toggles blank on the current selection. */
export function blankKeymap() {
  return keymap({
    "Mod-Shift-Backspace": toggleBlank,
  });
}

// ─────────────────────────────────────────────────── Bubble menu

const shouldShowBlankBubble = (state: EditorState): boolean => {
  if (state.selection.empty) return false;
  return isSelectionInClozePrompt(state);
};

export function FillInTheBlankBubbleMenu() {
  const editorState = useEditorState();
  const blankType = editorState?.schema.marks["blank"];

  const hasBlank = (() => {
    if (!editorState || !blankType) return false;
    const { from, to, empty } = editorState.selection;
    if (empty) return false;
    return editorState.doc.rangeHasMark(from, to, blankType);
  })();

  const toggle = useEditorEventCallback((view) => {
    if (!view) return;
    toggleBlank(view.state, view.dispatch);
  });

  if (!blankType) return null;

  return (
    <FloatingMenu placement="top" offset={6} shouldShow={shouldShowBlankBubble}>
      <div className="pp-blank-bubble">
        <button
          type="button"
          onClick={() => toggle()}
          onMouseDown={(e) => e.preventDefault()}
          className={`pp-blank-bubble-btn${hasBlank ? " is-active" : ""}`}
        >
          {hasBlank ? "Remove blank" : "Mark as blank"}
        </button>
        <span className="pp-blank-bubble-hint">⌘⇧⌫</span>
      </div>
    </FloatingMenu>
  );
}

// ─────────────────────────────────────────────────── NodeViews

export function ClozeView({
  ref,
  nodeProps,
  children,
}: NodeViewComponentProps) {
  return (
    <div ref={ref} className="pp-item pp-cloze">
      <div className="pp-item-label" contentEditable={false}>
        Fill in the blanks
      </div>
      <div ref={nodeProps.contentDOMRef} className="pp-cloze-content">
        {children}
      </div>
    </div>
  );
}

export function ClozePromptView({
  ref,
  nodeProps,
  children,
}: NodeViewComponentProps) {
  return (
    <div ref={ref} className="pp-cloze-prompt-wrapper">
      <div ref={nodeProps.contentDOMRef} className="pp-cloze-prompt">
        {children}
      </div>
    </div>
  );
}

export const clozeNodeViewComponents = {
  cloze: ClozeView,
  cloze_prompt: ClozePromptView,
};
