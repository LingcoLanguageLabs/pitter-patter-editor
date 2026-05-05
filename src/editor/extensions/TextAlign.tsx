import {
  TextAlignCenter,
  TextAlignJustify,
  TextAlignLeft,
  TextAlignRight,
} from "@phosphor-icons/react";
import { useEditorState } from "@handlewithcare/react-prosemirror";
import type { NodeSpec } from "prosemirror-model";
import type { Command, EditorState } from "prosemirror-state";
import type { ComponentType } from "react";

import { useEditor } from "../Editor";
import { CommandItem } from "../menu";
import { Extension } from "../types";

const ALIGN_NODES = ["paragraph", "heading"] as const;
type AlignValue = "left" | "center" | "right" | "justify";

function withAlign(base: NodeSpec): NodeSpec {
  const baseAttrs = base.attrs ?? {};
  const baseToDOM = base.toDOM;
  return {
    ...base,
    attrs: { ...baseAttrs, align: { default: null } },
    parseDOM: (base.parseDOM ?? []).map((rule) => ({
      ...rule,
      getAttrs(node: HTMLElement | string) {
        const baseAttrs =
          typeof rule.getAttrs === "function"
            ? rule.getAttrs(node as never)
            : rule.attrs ?? null;
        if (baseAttrs === false) return false;
        if (typeof node === "string") return baseAttrs ?? null;
        const align = node.style.textAlign;
        const valid: AlignValue[] = ["left", "center", "right", "justify"];
        const alignValue = valid.includes(align as AlignValue) ? align : null;
        return { ...(baseAttrs ?? {}), align: alignValue };
      },
    })),
    toDOM(node) {
      const result = baseToDOM ? baseToDOM(node) : null;
      if (!result || !node.attrs["align"]) return result ?? ["div", 0];
      const align = node.attrs["align"];
      if (Array.isArray(result)) {
        const [tag, second, ...rest] = result;
        const isAttrs = second && typeof second === "object" && !Array.isArray(second) &&
          !(second && (second as { nodeType?: number }).nodeType);
        const attrs = isAttrs ? { ...(second as Record<string, unknown>) } : {};
        const existingStyle = (attrs["style"] as string | undefined) ?? "";
        attrs["style"] = `${existingStyle}${existingStyle ? "; " : ""}text-align: ${align}`;
        return isAttrs
          ? [tag, attrs, ...rest]
          : [tag, attrs, ...(second !== undefined ? [second, ...rest] : [])];
      }
      return result;
    },
  };
}

function setAlignment(align: AlignValue | null): Command {
  return (state, dispatch) => {
    const { selection } = state;
    const { from, to } = selection;
    let didChange = false;
    let canChange = false;
    const tr = state.tr;
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (!ALIGN_NODES.includes(node.type.name as (typeof ALIGN_NODES)[number])) {
        return true;
      }
      if (!("align" in (node.type.spec.attrs ?? {}))) return true;
      canChange = true;
      if (node.attrs["align"] !== align) {
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, align });
        didChange = true;
      }
      return false;
    });
    if (!canChange) return false;
    if (dispatch && didChange) dispatch(tr);
    return true;
  };
}

function getActiveAlignment(state: EditorState | null): AlignValue | "default" | null {
  if (!state) return null;
  const { from, to } = state.selection;
  let result: string | null = null;
  let conflict = false;
  state.doc.nodesBetween(from, to, (node) => {
    if (!ALIGN_NODES.includes(node.type.name as (typeof ALIGN_NODES)[number])) return true;
    const value = (node.attrs["align"] as string | null) ?? "default";
    if (result === null) result = value;
    else if (result !== value) conflict = true;
    return false;
  });
  if (conflict) return null;
  return (result as AlignValue | "default" | null) ?? null;
}

interface AlignButtonProps {
  align: AlignValue;
  Icon: ComponentType<{ size: number; weight: "bold" }>;
  tooltip: string;
}

function AlignButton({ align, Icon, tooltip }: AlignButtonProps) {
  const editorState = useEditorState();
  const current = getActiveAlignment(editorState);
  const active =
    current === align || (align === "left" && current === "default");
  return (
    <CommandItem command={setAlignment(align)} active={active} tooltip={tooltip}>
      <Icon size={18} weight="bold" />
    </CommandItem>
  );
}

function TextAlignToolbarItem() {
  return (
    <>
      <AlignButton align="left" Icon={TextAlignLeft} tooltip="Align left" />
      <AlignButton align="center" Icon={TextAlignCenter} tooltip="Align center" />
      <AlignButton align="right" Icon={TextAlignRight} tooltip="Align right" />
      <AlignButton align="justify" Icon={TextAlignJustify} tooltip="Justify" />
    </>
  );
}

export const TextAlign = Extension.create({
  name: "text-align",
  patchNodes: {
    paragraph: withAlign,
    heading: withAlign,
  },
  toolbar: TextAlignToolbarItem,
  meta: { label: "Text alignment", group: "block" },
});
