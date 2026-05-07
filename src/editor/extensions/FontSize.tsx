import { Check } from "@phosphor-icons/react";
import {
  useEditorEventCallback,
  useEditorState,
} from "@handlewithcare/react-prosemirror";
import * as RadixDropdownMenu from "@radix-ui/react-dropdown-menu";
import type { MarkSpec, MarkType } from "prosemirror-model";
import type { Command, EditorState } from "prosemirror-state";

import { useEditor } from "../Editor";
import { isMarkActive } from "../helpers";
import { Dropdown } from "../menu";
import { Extension } from "../types";

export const DEFAULT_FONT_SIZES = [
  "10px",
  "11px",
  "12px",
  "13px",
  "14px",
  "16px",
  "18px",
  "20px",
  "24px",
  "30px",
  "36px",
  "48px",
  "60px",
  "72px",
];

const fontSizeSpec: MarkSpec = {
  attrs: {
    fontSize: { default: null },
  },
  parseDOM: [
    {
      tag: "span[data-font-size]",
      getAttrs: (dom) => ({
        fontSize: (dom as HTMLElement).getAttribute("data-font-size"),
      }),
    },
    {
      style: "font-size",
      getAttrs: (value) => (value ? { fontSize: value as string } : false),
    },
  ],
  toDOM(mark) {
    const fontSize = mark.attrs["fontSize"];
    const attrs: Record<string, string> = {};
    if (fontSize) {
      attrs["data-font-size"] = fontSize;
      attrs["style"] = `font-size: ${fontSize}`;
    }
    return ["span", attrs, 0];
  },
};

function setFontSize(markType: MarkType, fontSize: string): Command {
  return (state, dispatch) => {
    const { from, to, empty } = state.selection;
    if (dispatch) {
      const tr = state.tr;
      if (empty) {
        const stored = (state.storedMarks ?? state.selection.$from.marks()).filter(
          (m) => m.type !== markType,
        );
        tr.setStoredMarks([...stored, markType.create({ fontSize })]);
      } else {
        tr.removeMark(from, to, markType);
        tr.addMark(from, to, markType.create({ fontSize }));
      }
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

function unsetFontSize(markType: MarkType): Command {
  return (state, dispatch) => {
    const { from, to, empty } = state.selection;
    if (dispatch) {
      const tr = state.tr;
      if (empty) {
        const stored = (state.storedMarks ?? state.selection.$from.marks()).filter(
          (m) => m.type !== markType,
        );
        tr.setStoredMarks(stored);
      } else {
        tr.removeMark(from, to, markType);
      }
      dispatch(tr);
    }
    return true;
  };
}

function getActiveFontSize(state: EditorState | null, markType: MarkType): string | null {
  if (!state) return null;
  const { from, to, empty, $from } = state.selection;
  const marks = empty ? state.storedMarks ?? $from.marks() : null;
  if (marks) {
    const mark = marks.find((m) => m.type === markType);
    return mark?.attrs["fontSize"] ?? null;
  }
  let found: string | null = null;
  state.doc.nodesBetween(from, to, (node) => {
    if (found) return false;
    const mark = node.marks.find((m) => m.type === markType);
    if (mark) found = mark.attrs["fontSize"] ?? null;
  });
  return found;
}

interface FontSizePickerItemProps {
  size: string;
  active: boolean;
  onSelect: (size: string) => void;
}

function FontSizePickerItem({ size, active, onSelect }: FontSizePickerItemProps) {
  return (
    <RadixDropdownMenu.Item
      className="pp-dropdown-item pp-font-item"
      data-active={active || undefined}
      onMouseDown={(e) => e.preventDefault()}
      onSelect={(e) => {
        e.preventDefault();
        onSelect(size);
      }}
    >
      <span className="pp-font-check" aria-hidden>
        {active && <Check size={12} weight="bold" />}
      </span>
      <span className="pp-font-name">{parseInt(size, 10)}</span>
    </RadixDropdownMenu.Item>
  );
}

interface FontSizeToolbarItemProps {
  sizes: string[];
  defaultLabel: string;
}

function FontSizeToolbarItem({ sizes, defaultLabel }: FontSizeToolbarItemProps) {
  const { schema } = useEditor();
  const editorState = useEditorState();
  const markType = schema.marks["font_size"];

  const apply = useEditorEventCallback((view, size: string | null) => {
    if (!view || !markType) return;
    const cmd = size === null ? unsetFontSize(markType) : setFontSize(markType, size);
    cmd(view.state, view.dispatch);
    view.focus();
  });

  if (!markType) return null;

  const activeSize = getActiveFontSize(editorState, markType);
  const triggerLabel = activeSize ? String(parseInt(activeSize, 10)) : defaultLabel;

  return (
    <Dropdown
      label={<span className="pp-font-size-trigger">{triggerLabel}</span>}
      title="Font size"
      triggerStyle={{ minWidth: 56 }}
    >
      <RadixDropdownMenu.Item
        className="pp-dropdown-item pp-font-item"
        data-active={!activeSize || undefined}
        onMouseDown={(e) => e.preventDefault()}
        onSelect={(e) => {
          e.preventDefault();
          apply(null);
        }}
      >
        <span className="pp-font-check" aria-hidden>
          {!activeSize && <Check size={12} weight="bold" />}
        </span>
        <span className="pp-font-name">{defaultLabel}</span>
      </RadixDropdownMenu.Item>
      <RadixDropdownMenu.Separator className="pp-dropdown-separator" />
      {sizes.map((size) => (
        <FontSizePickerItem
          key={size}
          size={size}
          active={activeSize === size}
          onSelect={apply}
        />
      ))}
    </Dropdown>
  );
}

export interface FontSizeOptions {
  sizes?: string[];
  defaultLabel?: string;
}

export function createFontSize({
  sizes = DEFAULT_FONT_SIZES,
  defaultLabel = "Size",
}: FontSizeOptions = {}) {
  return Extension.create({
    name: "font-size",
    marks: { font_size: fontSizeSpec },
    isActive: (state, schema) => {
      const markType = schema.marks["font_size"];
      return markType ? isMarkActive(state, markType) : false;
    },
    toolbar: () => <FontSizeToolbarItem sizes={sizes} defaultLabel={defaultLabel} />,
    meta: { label: "Font size", group: "format" },
  });
}

export const FontSize = createFontSize();
