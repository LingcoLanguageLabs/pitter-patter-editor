import { Check } from "@phosphor-icons/react";
import {
  useEditorEventCallback,
  useEditorState,
} from "@handlewithcare/react-prosemirror";
import * as RadixDropdownMenu from "@radix-ui/react-dropdown-menu";
import type { NodeSpec } from "prosemirror-model";
import type { Command, EditorState } from "prosemirror-state";

import { Dropdown } from "../menu";
import { Extension } from "../types";

export const DEFAULT_LINE_HEIGHTS = ["1", "1.15", "1.5", "2", "2.5", "3"];
const LINE_HEIGHT_NODES = ["paragraph", "heading"] as const;

function withLineHeight(base: NodeSpec): NodeSpec {
  const baseToDOM = base.toDOM;
  return {
    ...base,
    attrs: { ...(base.attrs ?? {}), lineHeight: { default: null } },
    parseDOM: (base.parseDOM ?? []).map((rule) => ({
      ...rule,
      getAttrs(node: HTMLElement | string) {
        const baseAttrs =
          typeof rule.getAttrs === "function"
            ? rule.getAttrs(node as never)
            : rule.attrs ?? null;
        if (baseAttrs === false) return false;
        if (typeof node === "string") return baseAttrs ?? null;
        const lineHeight = node.style.lineHeight;
        return { ...(baseAttrs ?? {}), lineHeight: lineHeight || null };
      },
    })),
    toDOM(node) {
      const result = baseToDOM ? baseToDOM(node) : null;
      if (!result || !node.attrs["lineHeight"]) return result ?? ["div", 0];
      const lineHeight = node.attrs["lineHeight"];
      if (Array.isArray(result)) {
        const [tag, second, ...rest] = result;
        const isAttrs =
          second &&
          typeof second === "object" &&
          !Array.isArray(second) &&
          !(second && (second as { nodeType?: number }).nodeType);
        const attrs = isAttrs ? { ...(second as Record<string, unknown>) } : {};
        const existingStyle = (attrs["style"] as string | undefined) ?? "";
        attrs["style"] = `${existingStyle}${existingStyle ? "; " : ""}line-height: ${lineHeight}`;
        return isAttrs
          ? [tag, attrs, ...rest]
          : [tag, attrs, ...(second !== undefined ? [second, ...rest] : [])];
      }
      return result;
    },
  };
}

function setLineHeight(value: string | null): Command {
  return (state, dispatch) => {
    const { from, to } = state.selection;
    let didChange = false;
    let canChange = false;
    const tr = state.tr;
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (!LINE_HEIGHT_NODES.includes(node.type.name as (typeof LINE_HEIGHT_NODES)[number])) {
        return true;
      }
      if (!("lineHeight" in (node.type.spec.attrs ?? {}))) return true;
      canChange = true;
      if (node.attrs["lineHeight"] !== value) {
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, lineHeight: value });
        didChange = true;
      }
      return false;
    });
    if (!canChange) return false;
    if (dispatch && didChange) dispatch(tr);
    return true;
  };
}

function getActiveLineHeight(state: EditorState | null): string | null {
  if (!state) return null;
  const { from, to } = state.selection;
  let result: string | null | undefined;
  let conflict = false;
  state.doc.nodesBetween(from, to, (node) => {
    if (!LINE_HEIGHT_NODES.includes(node.type.name as (typeof LINE_HEIGHT_NODES)[number])) return true;
    const value = (node.attrs["lineHeight"] as string | null) ?? null;
    if (result === undefined) result = value;
    else if (result !== value) conflict = true;
    return false;
  });
  if (conflict) return null;
  return result ?? null;
}

interface LineHeightItemProps {
  value: string | null;
  active: boolean;
  label: string;
  onSelect: (value: string | null) => void;
}

function LineHeightItem({ value, active, label, onSelect }: LineHeightItemProps) {
  return (
    <RadixDropdownMenu.Item
      className="pp-dropdown-item pp-font-item"
      data-active={active || undefined}
      onMouseDown={(e) => e.preventDefault()}
      onSelect={(e) => {
        e.preventDefault();
        onSelect(value);
      }}
    >
      <span className="pp-font-check" aria-hidden>
        {active && <Check size={12} weight="bold" />}
      </span>
      <span className="pp-font-name">{label}</span>
    </RadixDropdownMenu.Item>
  );
}

interface LineHeightToolbarItemProps {
  values: string[];
  defaultLabel: string;
}

function LineHeightToolbarItem({ values, defaultLabel }: LineHeightToolbarItemProps) {
  const editorState = useEditorState();
  const active = getActiveLineHeight(editorState);

  const apply = useEditorEventCallback((view, value: string | null) => {
    if (!view) return;
    setLineHeight(value)(view.state, view.dispatch);
    view.focus();
  });

  const triggerLabel = active ?? defaultLabel;

  return (
    <Dropdown
      label={<span>{triggerLabel}</span>}
      title="Line height"
      triggerStyle={{ minWidth: 64 }}
    >
      <LineHeightItem
        value={null}
        active={!active}
        label={defaultLabel}
        onSelect={apply}
      />
      <RadixDropdownMenu.Separator className="pp-dropdown-separator" />
      {values.map((v) => (
        <LineHeightItem
          key={v}
          value={v}
          active={active === v}
          label={v}
          onSelect={apply}
        />
      ))}
    </Dropdown>
  );
}

export interface LineHeightOptions {
  values?: string[];
  defaultLabel?: string;
}

export function createLineHeight({
  values = DEFAULT_LINE_HEIGHTS,
  defaultLabel = "Default",
}: LineHeightOptions = {}) {
  return Extension.create({
    name: "line-height",
    patchNodes: {
      paragraph: withLineHeight,
      heading: withLineHeight,
    },
    toolbar: () => (
      <LineHeightToolbarItem values={values} defaultLabel={defaultLabel} />
    ),
    meta: { label: "Line height", group: "block" },
  });
}

export const LineHeight = createLineHeight();
