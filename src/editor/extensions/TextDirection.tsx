import { useEditorState } from "@handlewithcare/react-prosemirror";
import type { NodeSpec } from "prosemirror-model";
import type { Command, EditorState } from "prosemirror-state";

import { CommandItem } from "../menu";
import { Extension } from "../types";

const DIR_NODES = ["paragraph", "heading"] as const;
type DirValue = "ltr" | "rtl";

function withDir(base: NodeSpec): NodeSpec {
  const baseToDOM = base.toDOM;
  return {
    ...base,
    attrs: { ...(base.attrs ?? {}), dir: { default: null } },
    parseDOM: (base.parseDOM ?? []).map((rule) => ({
      ...rule,
      getAttrs(node: HTMLElement | string) {
        const baseAttrs =
          typeof rule.getAttrs === "function"
            ? rule.getAttrs(node as never)
            : rule.attrs ?? null;
        if (baseAttrs === false) return false;
        if (typeof node === "string") return baseAttrs ?? null;
        const dir = node.getAttribute("dir");
        const value: DirValue | null = dir === "ltr" || dir === "rtl" ? dir : null;
        return { ...(baseAttrs ?? {}), dir: value };
      },
    })),
    toDOM(node) {
      const result = baseToDOM ? baseToDOM(node) : null;
      if (!result || !node.attrs["dir"]) return result ?? ["div", 0];
      const dir = node.attrs["dir"];
      if (Array.isArray(result)) {
        const [tag, second, ...rest] = result;
        const isAttrs =
          second &&
          typeof second === "object" &&
          !Array.isArray(second) &&
          !(second && (second as { nodeType?: number }).nodeType);
        const attrs = isAttrs ? { ...(second as Record<string, unknown>) } : {};
        attrs["dir"] = dir;
        return isAttrs
          ? [tag, attrs, ...rest]
          : [tag, attrs, ...(second !== undefined ? [second, ...rest] : [])];
      }
      return result;
    },
  };
}

function setDirection(dir: DirValue | null): Command {
  return (state, dispatch) => {
    const { from, to } = state.selection;
    let didChange = false;
    let canChange = false;
    const tr = state.tr;
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (!DIR_NODES.includes(node.type.name as (typeof DIR_NODES)[number])) return true;
      if (!("dir" in (node.type.spec.attrs ?? {}))) return true;
      canChange = true;
      if (node.attrs["dir"] !== dir) {
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, dir });
        didChange = true;
      }
      return false;
    });
    if (!canChange) return false;
    if (dispatch && didChange) dispatch(tr);
    return true;
  };
}

function getActiveDirection(state: EditorState | null): DirValue | null {
  if (!state) return null;
  const { from, to } = state.selection;
  let result: DirValue | null | undefined;
  let conflict = false;
  state.doc.nodesBetween(from, to, (node) => {
    if (!DIR_NODES.includes(node.type.name as (typeof DIR_NODES)[number])) return true;
    const v = (node.attrs["dir"] as DirValue | null) ?? null;
    if (result === undefined) result = v;
    else if (result !== v) conflict = true;
    return false;
  });
  if (conflict) return null;
  return result ?? null;
}

interface DirButtonProps {
  dir: DirValue;
  label: string;
  tooltip: string;
}

function DirButton({ dir, label, tooltip }: DirButtonProps) {
  const editorState = useEditorState();
  const active = getActiveDirection(editorState) === dir;
  return (
    <CommandItem command={setDirection(dir)} active={active} tooltip={tooltip}>
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em" }}>
        {label}
      </span>
    </CommandItem>
  );
}

function TextDirectionToolbarItem() {
  return (
    <>
      <DirButton dir="ltr" label="LTR" tooltip="Left to right" />
      <DirButton dir="rtl" label="RTL" tooltip="Right to left" />
    </>
  );
}

export const TextDirection = Extension.create({
  name: "text-direction",
  patchNodes: {
    paragraph: withDir,
    heading: withDir,
  },
  toolbar: TextDirectionToolbarItem,
  meta: { label: "Text direction", group: "block" },
});
