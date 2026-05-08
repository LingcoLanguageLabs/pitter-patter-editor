/**
 * Multiple-choice quiz block — a story-scoped extension (lives outside
 * `editor/extensions/` because we don't ship it as part of the toolkit).
 *
 * Schema:
 *   quiz                 — block container
 *     quiz_prompt        — the question text (1)
 *     quiz_choice        — each answer option (1+), with `correct: bool`
 *
 * Editing UX (driven entirely by ProseMirror):
 *   - Prompt is editable inline.
 *   - Each choice has a radio (single-select; clicking sets `correct`
 *     true on the clicked choice, false on its siblings), an editable
 *     text field, and a delete button (disabled when only one choice
 *     remains).
 *   - An "Add choice" button at the bottom inserts a new empty choice.
 */

import {
  useEditorEventCallback,
  useEditorState,
  type NodeViewComponentProps,
} from "@handlewithcare/react-prosemirror";
import { Trash } from "@phosphor-icons/react";
import type { Node as PmNode, NodeSpec, Schema } from "prosemirror-model";
import { Schema as PMSchema } from "prosemirror-model";

// ─────────────────────────────────────────────────── Schema

export const quizSpec: NodeSpec = {
  group: "block",
  content: "quiz_prompt quiz_choice+",
  defining: true,
  isolating: true,
  draggable: true,
  parseDOM: [{ tag: 'div[data-type="quiz"]' }],
  toDOM: () => ["div", { "data-type": "quiz", class: "pp-quiz" }, 0],
};

export const quizPromptSpec: NodeSpec = {
  content: "inline*",
  defining: true,
  parseDOM: [{ tag: 'div[data-type="quiz-prompt"]' }],
  toDOM: () => [
    "div",
    { "data-type": "quiz-prompt", class: "pp-quiz-prompt" },
    0,
  ],
};

export const quizChoiceSpec: NodeSpec = {
  content: "inline*",
  defining: true,
  attrs: {
    correct: { default: false },
  },
  parseDOM: [
    {
      tag: 'div[data-type="quiz-choice"]',
      getAttrs(dom) {
        if (!(dom instanceof HTMLElement)) return false;
        return { correct: dom.getAttribute("data-correct") === "true" };
      },
    },
  ],
  toDOM: (node) => [
    "div",
    {
      "data-type": "quiz-choice",
      "data-correct": String(node.attrs["correct"]),
      class: "pp-quiz-choice",
    },
    0,
  ],
};

/**
 * Append the quiz nodes to an existing schema. The shuffle plugin's
 * `addShuffleNodes` should be called *after* this so it picks up the
 * `quiz` block in the "block" group.
 */
export function addQuizToSchema(schema: Schema): Schema {
  const nodes = schema.spec.nodes.append({
    quiz: quizSpec,
    quiz_prompt: quizPromptSpec,
    quiz_choice: quizChoiceSpec,
  });
  return new PMSchema({ nodes, marks: schema.spec.marks });
}

// ─────────────────────────────────────────────────── Doc helpers

export function buildQuiz(
  schema: Schema,
  prompt: string,
  choices: ReadonlyArray<{ text: string; correct?: boolean }>,
): PmNode {
  const promptType = schema.nodes["quiz_prompt"];
  const choiceType = schema.nodes["quiz_choice"];
  const quizType = schema.nodes["quiz"];
  if (!promptType || !choiceType || !quizType) {
    throw new Error(
      "Quiz schema not installed. Call addQuizToSchema(schema) first.",
    );
  }
  const promptNode = promptType.create(null, schema.text(prompt));
  const choiceNodes = choices.map((c) =>
    choiceType.create({ correct: !!c.correct }, schema.text(c.text)),
  );
  return quizType.create(null, [promptNode, ...choiceNodes]);
}

// ─────────────────────────────────────────────────── NodeViews

/**
 * Quiz block — contentDOM holds prompt + choice children. The
 * "Add choice" button sits below them (outside contentDOM).
 */
export function QuizView({ nodeProps, ref, children }: NodeViewComponentProps) {
  const { node, getPos } = nodeProps;

  const addChoice = useEditorEventCallback((view) => {
    if (!view) return;
    const pos = getPos();
    if (pos === undefined || pos === null) return;
    const choiceType = view.state.schema.nodes["quiz_choice"];
    if (!choiceType) return;
    // Insert just before the quiz's closing token.
    const endOfContent = pos + node.nodeSize - 1;
    const newChoice = choiceType.create({ correct: false });
    view.dispatch(view.state.tr.insert(endOfContent, newChoice).scrollIntoView());
  });

  return (
    <div className="pp-quiz">
      <div className="pp-quiz-label" contentEditable={false}>
        Multiple choice
      </div>
      <div ref={ref} className="pp-quiz-content">
        {children}
      </div>
      <button
        type="button"
        contentEditable={false}
        onClick={addChoice}
        className="pp-quiz-add"
      >
        + Add choice
      </button>
    </div>
  );
}

/** Prompt — labeled editable text field. */
export function QuizPromptView({ ref, children }: NodeViewComponentProps) {
  return (
    <div className="pp-quiz-prompt-wrapper">
      <div ref={ref} className="pp-quiz-prompt">
        {children}
      </div>
    </div>
  );
}

/** Choice — radio + editable text + delete. */
export function QuizChoiceView({
  nodeProps,
  ref,
  children,
}: NodeViewComponentProps) {
  const { node, getPos } = nodeProps;
  const correct = !!node.attrs["correct"];

  const pickCorrect = useEditorEventCallback((view) => {
    if (!view) return;
    const pos = getPos();
    if (pos === undefined || pos === null) return;
    const $pos = view.state.doc.resolve(pos);
    const parent = $pos.parent;
    const parentStart = $pos.start();
    let tr = view.state.tr;
    parent.forEach((child: PmNode, offset: number) => {
      if (child.type.name !== "quiz_choice") return;
      const childPos = parentStart + offset;
      const want = childPos === pos;
      if (child.attrs["correct"] !== want) {
        tr = tr.setNodeMarkup(childPos, undefined, {
          ...child.attrs,
          correct: want,
        });
      }
    });
    if (tr.docChanged) view.dispatch(tr);
  });

  const deleteChoice = useEditorEventCallback((view) => {
    if (!view) return;
    const pos = getPos();
    if (pos === undefined || pos === null) return;
    const $pos = view.state.doc.resolve(pos);
    const parent = $pos.parent;
    // Count siblings of type quiz_choice — refuse to delete the last one
    // since the schema requires at least one.
    let choiceCount = 0;
    parent.forEach((child: PmNode) => {
      if (child.type.name === "quiz_choice") choiceCount += 1;
    });
    if (choiceCount <= 1) return;
    view.dispatch(view.state.tr.delete(pos, pos + node.nodeSize));
  });

  // Compute whether delete is allowed (visual hint).
  const editorState = useEditorState();
  const pos = getPos();
  let canDelete = false;
  if (editorState && pos !== undefined && pos !== null) {
    const $pos = editorState.doc.resolve(pos);
    let count = 0;
    $pos.parent.forEach((child: PmNode) => {
      if (child.type.name === "quiz_choice") count += 1;
    });
    canDelete = count > 1;
  }

  return (
    <div
      className={`pp-quiz-choice${correct ? " pp-quiz-choice--correct" : ""}`}
    >
      <input
        type="radio"
        checked={correct}
        onChange={pickCorrect}
        onMouseDown={(e) => e.preventDefault()}
        contentEditable={false}
        className="pp-quiz-choice-radio"
        aria-label="Mark as correct answer"
      />
      <div ref={ref} className="pp-quiz-choice-text">
        {children}
      </div>
      <button
        type="button"
        contentEditable={false}
        onClick={deleteChoice}
        onMouseDown={(e) => e.preventDefault()}
        disabled={!canDelete}
        className="pp-quiz-choice-delete"
        aria-label="Delete choice"
        title={canDelete ? "Delete choice" : "A quiz needs at least one choice"}
      >
        <Trash size={14} weight="bold" />
      </button>
    </div>
  );
}

/** NodeViewComponents map ready to drop into a ProseMirror setup. */
export const quizNodeViewComponents = {
  quiz: QuizView,
  quiz_prompt: QuizPromptView,
  quiz_choice: QuizChoiceView,
};
