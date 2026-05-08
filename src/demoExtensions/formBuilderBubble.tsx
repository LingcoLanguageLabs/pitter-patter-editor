/**
 * Floating bubble menu for the Form Builder editor.
 *
 * Renders one button per mark extension passed in (Bold / Italic /
 * Underline / Strike — pulled from the same Extension objects the
 * configured editor uses), and conditionally appends a "Mark as blank"
 * button when the selection sits inside a `cloze_prompt` node.
 */

import {
  useEditorEventCallback,
  useEditorState,
} from "@handlewithcare/react-prosemirror";
import type { EditorState } from "prosemirror-state";

import { FloatingMenu } from "../editor/menu/FloatingMenu";
import type { Extension } from "../editor/types";
import { isSelectionInClozePrompt, toggleBlank } from "./fillInTheBlank";

interface FormBuilderBubbleMenuProps {
  /** Mark extensions to expose as bubble buttons. */
  markExtensions: readonly Extension[];
}

const shouldShow = (state: EditorState) => !state.selection.empty;

export function FormBuilderBubbleMenu({
  markExtensions,
}: FormBuilderBubbleMenuProps) {
  const editorState = useEditorState();
  const blankType = editorState?.schema.marks["blank"];

  return (
    <FloatingMenu placement="top" offset={6} shouldShow={shouldShow}>
      <div className="pp-fb-bubble">
        {markExtensions.map((ext) => (
          <MarkButton key={ext.name} ext={ext} />
        ))}
        {blankType && editorState && isSelectionInClozePrompt(editorState) && (
          <>
            <span className="pp-fb-bubble-divider" />
            <BlankButton />
          </>
        )}
      </div>
    </FloatingMenu>
  );
}

function MarkButton({ ext }: { ext: Extension }) {
  const editorState = useEditorState();
  const Icon = ext.meta?.Icon;
  const label = ext.meta?.label ?? ext.name;
  const shortcut = ext.meta?.shortcut;

  const isActive =
    editorState && ext.isActive
      ? ext.isActive(editorState, editorState.schema)
      : false;

  const run = useEditorEventCallback((view) => {
    if (!view) return;
    if (!ext.commands) return;
    const commandName = Object.keys(ext.commands)[0];
    if (!commandName) return;
    const factory = ext.commands[commandName];
    if (!factory) return;
    const command = factory(view.state.schema);
    command(view.state, view.dispatch);
    view.focus();
  });

  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => run()}
      className={`pp-fb-bubble-btn${isActive ? " is-active" : ""}`}
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-label={label}
    >
      {Icon ? <Icon size={14} weight="bold" /> : label.charAt(0)}
    </button>
  );
}

function BlankButton() {
  const editorState = useEditorState();
  const blankType = editorState?.schema.marks["blank"];

  const hasBlank = (() => {
    if (!editorState || !blankType) return false;
    const { from, to, empty } = editorState.selection;
    if (empty) return false;
    return editorState.doc.rangeHasMark(from, to, blankType);
  })();

  const run = useEditorEventCallback((view) => {
    if (!view) return;
    toggleBlank(view.state, view.dispatch);
    view.focus();
  });

  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => run()}
      className={`pp-fb-bubble-blank${hasBlank ? " is-active" : ""}`}
      title="Mark as blank (⌘⇧⌫)"
    >
      {hasBlank ? "Remove blank" : "Mark as blank"}
    </button>
  );
}
