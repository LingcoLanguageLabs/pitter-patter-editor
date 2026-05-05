import { TextAa } from "@phosphor-icons/react";
import {
  useEditorEventCallback,
  useEditorState,
} from "@handlewithcare/react-prosemirror";
import type { MarkSpec, MarkType } from "prosemirror-model";
import type { Command, EditorState } from "prosemirror-state";

import { useEditor } from "../Editor";
import { isMarkActive } from "../helpers";
import { Dropdown } from "../menu";
import { Extension } from "../types";

const textColorSpec: MarkSpec = {
  attrs: {
    color: { default: null },
  },
  parseDOM: [
    {
      tag: "span[data-text-color]",
      getAttrs: (dom) => ({ color: (dom as HTMLElement).getAttribute("data-text-color") }),
    },
    {
      style: "color",
      getAttrs: (value) => (value ? { color: value as string } : false),
    },
  ],
  toDOM(mark) {
    const color = mark.attrs["color"];
    const attrs: Record<string, string> = {};
    if (color) {
      attrs["data-text-color"] = color;
      attrs["style"] = `color: ${color}`;
    }
    return ["span", attrs, 0];
  },
};

const COLORS = [
  { name: "Black", value: "#1a1a1a" },
  { name: "Gray", value: "#6b7280" },
  { name: "Red", value: "#dc2626" },
  { name: "Orange", value: "#ea580c" },
  { name: "Green", value: "#16a34a" },
  { name: "Blue", value: "#2563eb" },
  { name: "Purple", value: "#7c3aed" },
  { name: "Pink", value: "#db2777" },
];

function setTextColor(markType: MarkType, color: string): Command {
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

function unsetTextColor(markType: MarkType): Command {
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

function TextColorToolbarItem() {
  const { schema } = useEditor();
  const editorState = useEditorState();
  const markType = schema.marks["text_color"];

  const setColor = useEditorEventCallback((view, color: string) => {
    if (!view || !markType) return;
    setTextColor(markType, color)(view.state, view.dispatch);
    view.focus();
  });

  const clearColor = useEditorEventCallback((view) => {
    if (!view || !markType) return;
    unsetTextColor(markType)(view.state, view.dispatch);
    view.focus();
  });

  if (!markType) return null;
  const active = isMarkActive(editorState, markType);
  const activeColor = getActiveColor(editorState, markType);
  const canRun = editorState ? !editorState.selection.empty || active : false;

  return (
    <Dropdown
      tooltip="Text color"
      hideCaret
      triggerStyle={{ width: 30, padding: 0, gap: 0, opacity: canRun ? 1 : 0.4 }}
      triggerActive={active}
      label={
        <span
          className="pp-text-color-trigger"
          style={{ borderBottomColor: activeColor ?? "transparent" }}
        >
          <TextAa size={18} weight="bold" />
        </span>
      }
    >
      <div className="pp-highlight-swatches">
        {COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            className="pp-text-color-swatch"
            data-active={activeColor === c.value || undefined}
            title={c.name}
            style={{ color: c.value }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setColor(c.value)}
          >
            A
          </button>
        ))}
      </div>
      <button
        type="button"
        className="pp-dropdown-item pp-highlight-unset"
        onMouseDown={(e) => e.preventDefault()}
        onClick={clearColor}
        disabled={!active}
      >
        Default color
      </button>
    </Dropdown>
  );
}

export const TextColor = Extension.create({
  name: "text-color",
  marks: { text_color: textColorSpec },
  isActive: (state, schema) => isMarkActive(state, schema.marks["text_color"]!),
  toolbar: TextColorToolbarItem,
  meta: { label: "Text color", group: "format", Icon: TextAa },
});
