import { BracketsCurly, Plus } from "@phosphor-icons/react";
import {
  useEditorEffect,
  useEditorEventCallback,
  useEditorState,
} from "@handlewithcare/react-prosemirror";
import * as RadixDropdownMenu from "@radix-ui/react-dropdown-menu";
import * as RadixPopover from "@radix-ui/react-popover";
import type { NodeSpec, NodeType } from "prosemirror-model";
import {
  NodeSelection,
  TextSelection,
  type Command,
  type EditorState,
} from "prosemirror-state";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { useEditor } from "../Editor";
import { MenuItem } from "../menu/MenuItem";
import { Extension } from "../types";

export interface VariableDefinition {
  /** Identifier — what shows up between the `{{` `}}` and what consumers key by. */
  name: string;
  /** Optional human-readable label for pickers. Falls back to `name`. */
  label?: string;
  /** Default value rendered/used when no resolved value is bound. */
  defaultValue?: string;
}

const variableSpec: NodeSpec = {
  inline: true,
  group: "inline",
  atom: true,
  selectable: true,
  draggable: false,
  attrs: {
    name: { default: "" },
    defaultValue: { default: "" },
  },
  parseDOM: [
    {
      tag: "span[data-variable]",
      getAttrs(dom) {
        if (!(dom instanceof HTMLElement)) return false;
        return {
          name: dom.getAttribute("data-name") ?? "",
          defaultValue: dom.getAttribute("data-default") ?? "",
        };
      },
    },
  ],
  toDOM(node) {
    const name = (node.attrs["name"] as string) || "";
    const defaultValue = (node.attrs["defaultValue"] as string) || "";
    const attrs: Record<string, string> = {
      "data-variable": "",
      "data-name": name,
      class: "pp-variable",
    };
    if (defaultValue) attrs["data-default"] = defaultValue;
    return ["span", attrs, `{{${name || "?"}}}`];
  },
};

function isVariableSelected(
  state: EditorState | null,
  type: NodeType,
): boolean {
  if (!state) return false;
  const { selection } = state;
  return selection instanceof NodeSelection && selection.node.type === type;
}

function insertVariableCommand(
  type: NodeType,
  attrs: { name: string; defaultValue?: string },
): Command {
  return (state, dispatch) => {
    if (!attrs.name) return false;
    if (dispatch) {
      dispatch(
        state.tr
          .replaceSelectionWith(
            type.create({
              name: attrs.name,
              defaultValue: attrs.defaultValue ?? "",
            }),
            false,
          )
          .scrollIntoView(),
      );
    }
    return true;
  };
}

interface VariableToolbarItemProps {
  variables: VariableDefinition[];
  allowFreeform: boolean;
}

function VariableToolbarItem({
  variables,
  allowFreeform,
}: VariableToolbarItemProps) {
  const { schema } = useEditor();
  const editorState = useEditorState();
  const variableType = schema.nodes["variable"];
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [defaultValue, setDefaultValue] = useState("");

  const insert = useEditorEventCallback(
    (view, attrs: { name: string; defaultValue?: string }) => {
      if (!view || !variableType) return;
      insertVariableCommand(variableType, attrs)(view.state, view.dispatch);
      view.focus();
    },
  );

  if (!variableType) return null;
  const active = isVariableSelected(editorState, variableType);

  return (
    <RadixDropdownMenu.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setName("");
          setDefaultValue("");
        }
      }}
    >
      <RadixDropdownMenu.Trigger asChild>
        <MenuItem active={active} tooltip="Insert variable">
          <BracketsCurly size={18} weight="bold" />
        </MenuItem>
      </RadixDropdownMenu.Trigger>
      <RadixDropdownMenu.Portal>
        <RadixDropdownMenu.Content
          className="pp-dropdown-menu pp-variable-menu"
          side="bottom"
          align="start"
          sideOffset={6}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {variables.length > 0 && (
            <>
              <RadixDropdownMenu.Label className="pp-dropdown-section-label">
                Known variables
              </RadixDropdownMenu.Label>
              {variables.map((v) => (
                <RadixDropdownMenu.Item
                  key={v.name}
                  className="pp-dropdown-item pp-variable-item"
                  onMouseDown={(e) => e.preventDefault()}
                  onSelect={(e) => {
                    e.preventDefault();
                    insert({ name: v.name, defaultValue: v.defaultValue });
                    setOpen(false);
                  }}
                >
                  <span className="pp-variable-chip">{`{{${v.name}}}`}</span>
                  <span className="pp-variable-label">{v.label ?? v.name}</span>
                </RadixDropdownMenu.Item>
              ))}
              {allowFreeform && (
                <RadixDropdownMenu.Separator className="pp-dropdown-separator" />
              )}
            </>
          )}
          {allowFreeform && (
            <form
              className="pp-variable-form"
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = name.trim();
                if (!trimmed) return;
                insert({
                  name: trimmed,
                  defaultValue: defaultValue.trim() || undefined,
                });
                setOpen(false);
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <label className="pp-popover-label">Name</label>
              <input
                type="text"
                className="pp-popover-input"
                placeholder="customer_name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
              <label className="pp-popover-label">Default value (optional)</label>
              <input
                type="text"
                className="pp-popover-input"
                placeholder="Friend"
                value={defaultValue}
                onChange={(e) => setDefaultValue(e.target.value)}
              />
              <div className="pp-image-actions">
                <button
                  type="submit"
                  className="pp-popover-btn pp-popover-btn-primary"
                >
                  <Plus size={14} weight="bold" />
                  Insert
                </button>
              </div>
            </form>
          )}
        </RadixDropdownMenu.Content>
      </RadixDropdownMenu.Portal>
    </RadixDropdownMenu.Root>
  );
}

/**
 * Anchored popover that appears next to a selected variable so the user
 * can edit its name + default value in place. Mirrors the
 * MathInlinePopover pattern.
 */
export function VariableEditPopover() {
  const editorState = useEditorState();
  const { schema } = useEditor();
  const variableType = schema.nodes["variable"];

  const isSelected =
    !!variableType &&
    !!editorState &&
    editorState.selection instanceof NodeSelection &&
    editorState.selection.node.type === variableType;

  const selectionPos = isSelected ? editorState.selection.from : null;
  const selectedNode = isSelected
    ? (editorState.selection as NodeSelection).node
    : null;

  const [coords, setCoords] = useState<{ left: number; top: number } | null>(null);
  const [name, setName] = useState("");
  const [defaultValue, setDefaultValue] = useState("");

  useEditorEffect(
    (view) => {
      if (selectionPos == null) {
        setCoords(null);
        return;
      }
      const dom = view.nodeDOM(selectionPos);
      if (!(dom instanceof HTMLElement)) return;
      const rect = dom.getBoundingClientRect();
      setCoords({ left: rect.left, top: rect.bottom + 6 });
    },
    [selectionPos],
  );

  useEffect(() => {
    if (selectedNode) {
      setName((selectedNode.attrs["name"] as string) ?? "");
      setDefaultValue((selectedNode.attrs["defaultValue"] as string) ?? "");
    }
  }, [selectedNode]);

  const commit = useEditorEventCallback(
    (view, attrs: { name: string; defaultValue: string }) => {
      if (!view || selectionPos == null || !variableType) return;
      const node = view.state.doc.nodeAt(selectionPos);
      if (!node || node.type !== variableType) return;
      if (
        node.attrs["name"] === attrs.name &&
        node.attrs["defaultValue"] === attrs.defaultValue
      ) {
        return;
      }
      view.dispatch(
        view.state.tr.setNodeMarkup(selectionPos, undefined, {
          ...node.attrs,
          name: attrs.name,
          defaultValue: attrs.defaultValue,
        }),
      );
    },
  );

  const dismiss = useEditorEventCallback((view) => {
    if (!view || selectionPos == null) return;
    const after = selectionPos + 1;
    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, after)),
    );
    view.focus();
  });

  if (!coords || selectionPos == null) return null;

  return createPortal(
    <div
      className="pp-variable-popover"
      style={{ position: "fixed", left: coords.left, top: coords.top, zIndex: 100 }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <label className="pp-popover-label">Name</label>
      <input
        type="text"
        className="pp-popover-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => commit({ name: name.trim(), defaultValue })}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            dismiss();
          } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            commit({ name: name.trim(), defaultValue });
            dismiss();
          }
        }}
        autoFocus
      />
      <label className="pp-popover-label">Default value</label>
      <input
        type="text"
        className="pp-popover-input"
        value={defaultValue}
        onChange={(e) => setDefaultValue(e.target.value)}
        onBlur={() => commit({ name: name.trim(), defaultValue })}
      />
      <div className="pp-variable-popover-hint">⌘↩ to commit · Esc to dismiss</div>
    </div>,
    document.body,
  );
}

export interface VariableOptions {
  /** Variables surfaced in the toolbar dropdown. */
  variables?: VariableDefinition[];
  /** Allow inserting variables that aren't in the known list. Default: true. */
  allowFreeform?: boolean;
}

export function createVariables({
  variables = [],
  allowFreeform = true,
}: VariableOptions = {}) {
  return Extension.create({
    name: "variables",
    nodes: { variable: variableSpec },
    isActive: (state, schema) =>
      isVariableSelected(state, schema.nodes["variable"]!),
    toolbar: () => (
      <VariableToolbarItem
        variables={variables}
        allowFreeform={allowFreeform}
      />
    ),
    meta: { label: "Variable", group: "block", Icon: BracketsCurly },
  });
}

export const Variables = createVariables();
