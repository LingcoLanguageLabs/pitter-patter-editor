import { Highlighter } from "@phosphor-icons/react";
import {
  useEditorEventCallback,
  useEditorState,
} from "@handlewithcare/react-prosemirror";
import { toggleMark } from "prosemirror-commands";
import type { MarkSpec, MarkType } from "prosemirror-model";
import type { Command, EditorState } from "prosemirror-state";

import { useEditor } from "../Editor";
import { isMarkActive } from "../helpers";
import { Dropdown } from "../menu";
import { Extension } from "../types";

const highlightSpec: MarkSpec = {
  attrs: {
    color: { default: null },
  },
  parseDOM: [
    {
      tag: "mark",
      getAttrs: (dom) => ({ color: (dom as HTMLElement).getAttribute("data-color") }),
    },
    {
      style: "background-color",
      getAttrs: (value) => (value ? { color: value as string } : false),
    },
  ],
  toDOM(mark) {
    const color = mark.attrs["color"];
    const attrs: Record<string, string> = {};
    if (color) {
      attrs["data-color"] = color;
      attrs["style"] = `background-color: ${color}`;
    }
    return ["mark", attrs, 0];
  },
};

const COLORS = [
  { name: "Yellow", value: "#fff2a8" },
  { name: "Green", value: "#c4f3c8" },
  { name: "Blue", value: "#c8e3ff" },
  { name: "Purple", value: "#e0ccff" },
  { name: "Pink", value: "#ffd1e0" },
  { name: "Orange", value: "#ffd9b3" },
  { name: "Red", value: "#ffc7c7" },
  { name: "Gray", value: "#dedede" },
];

function setHighlight(markType: MarkType, color: string): Command {
  return (state, dispatch) => {
    const { from, to } = state.selection;
    if (from === to) return false;
    if (dispatch) {
      const tr = state.tr;
      tr.removeMark(from, to, markType);
      tr.addMark(from, to, markType.create({ color }));
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

function unsetHighlight(markType: MarkType): Command {
  return (state, dispatch) => {
    const { from, to } = state.selection;
    if (from === to) return false;
    if (dispatch) {
      dispatch(state.tr.removeMark(from, to, markType));
    }
    return true;
  };
}

function getActiveColor(state: EditorState | null, markType: MarkType): string | null {
  if (!state) return null;
  const { from, to, empty, $from } = state.selection;
  const marks = empty ? state.storedMarks ?? $from.marks() : null;
  if (marks) {
    const mark = marks.find((m) => m.type === markType);
    return mark?.attrs["color"] ?? null;
  }
  let found: string | null = null;
  state.doc.nodesBetween(from, to, (node) => {
    if (found) return false;
    const mark = node.marks.find((m) => m.type === markType);
    if (mark) found = mark.attrs["color"] ?? null;
  });
  return found;
}

function HighlightToolbarItem() {
  const { schema } = useEditor();
  const editorState = useEditorState();
  const markType = schema.marks["highlight"];

  const setColor = useEditorEventCallback((view, color: string) => {
    if (!view || !markType) return;
    setHighlight(markType, color)(view.state, view.dispatch);
    view.focus();
  });

  const clearHighlight = useEditorEventCallback((view) => {
    if (!view || !markType) return;
    unsetHighlight(markType)(view.state, view.dispatch);
    view.focus();
  });

  if (!markType) return null;
  const active = isMarkActive(editorState, markType);
  const activeColor = getActiveColor(editorState, markType);
  const canRun = editorState
    ? !editorState.selection.empty || active
    : false;

  return (
    <Dropdown
      tooltip="Highlight"
      shortcut="⌘⇧H"
      hideCaret
      triggerStyle={{ width: 30, padding: 0, gap: 0, opacity: canRun ? 1 : 0.4 }}
      triggerActive={active}
      label={
        <span
          className="pp-highlight-trigger"
          style={{
            background: activeColor ?? "transparent",
            borderRadius: 3,
            padding: 2,
            display: "inline-flex",
          }}
        >
          <Highlighter size={18} weight="bold" />
        </span>
      }
    >
      <div className="pp-highlight-swatches">
        {COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            className="pp-highlight-swatch"
            data-active={activeColor === c.value || undefined}
            title={c.name}
            style={{ background: c.value }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setColor(c.value)}
          />
        ))}
      </div>
      <button
        type="button"
        className="pp-dropdown-item pp-highlight-unset"
        onMouseDown={(e) => e.preventDefault()}
        onClick={clearHighlight}
        disabled={!active}
      >
        Remove highlight
      </button>
    </Dropdown>
  );
}

export const Highlight = Extension.create({
  name: "highlight",
  marks: { highlight: highlightSpec },
  commands: {
    highlight: (schema) => toggleMark(schema.marks["highlight"]!, { color: "#fff2a8" }),
  },
  keymap: { "Mod-Shift-h": "highlight", "Mod-Shift-H": "highlight" },
  isActive: (state, schema) => isMarkActive(state, schema.marks["highlight"]!),
  toolbar: HighlightToolbarItem,
  meta: { label: "Highlight", shortcut: "⌘⇧H", group: "format", Icon: Highlighter },
});
