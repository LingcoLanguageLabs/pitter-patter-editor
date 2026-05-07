import {
  Info,
  Lightbulb,
  Note,
  Warning,
  WarningOctagon,
} from "@phosphor-icons/react";
import { useEditorEventCallback, useEditorState } from "@handlewithcare/react-prosemirror";
import * as RadixDropdownMenu from "@radix-ui/react-dropdown-menu";
import { lift, wrapIn } from "prosemirror-commands";
import type { NodeSpec, NodeType } from "prosemirror-model";
import type { Command, EditorState } from "prosemirror-state";
import type { ComponentType } from "react";

import { useEditor } from "../Editor";
import { isAncestorActive } from "../helpers";
import { Dropdown } from "../menu";
import { Extension } from "../types";

export type CalloutVariant = "note" | "info" | "tip" | "warning" | "danger";

interface VariantConfig {
  id: CalloutVariant;
  label: string;
  Icon: ComponentType<{ size?: number; weight?: "bold" | "regular" }>;
}

export const CALLOUT_VARIANTS: VariantConfig[] = [
  { id: "note", label: "Note", Icon: Note },
  { id: "info", label: "Info", Icon: Info },
  { id: "tip", label: "Tip", Icon: Lightbulb },
  { id: "warning", label: "Warning", Icon: Warning },
  { id: "danger", label: "Danger", Icon: WarningOctagon },
];

const VARIANT_IDS = new Set<string>(CALLOUT_VARIANTS.map((v) => v.id));

const calloutSpec: NodeSpec = {
  attrs: { variant: { default: "note" } },
  content: "block+",
  group: "block",
  defining: true,
  parseDOM: [
    {
      tag: "div[data-callout]",
      getAttrs(dom) {
        if (!(dom instanceof HTMLElement)) return false;
        const v = dom.getAttribute("data-callout") ?? "note";
        return { variant: VARIANT_IDS.has(v) ? v : "note" };
      },
    },
  ],
  toDOM(node) {
    const variant = (node.attrs["variant"] as string | null) ?? "note";
    return [
      "div",
      {
        "data-callout": variant,
        class: `pp-callout pp-callout--${variant}`,
      },
      0,
    ];
  },
};

interface CalloutInfo {
  pos: number;
  variant: CalloutVariant;
}

function findCalloutAtSelection(
  state: EditorState,
  calloutType: NodeType,
): CalloutInfo | null {
  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type === calloutType) {
      return {
        pos: $from.before(d),
        variant: (node.attrs["variant"] as CalloutVariant) ?? "note",
      };
    }
  }
  return null;
}

export function setCallout(calloutType: NodeType, variant: CalloutVariant): Command {
  return (state, dispatch, view) => {
    const info = findCalloutAtSelection(state, calloutType);
    if (info) {
      if (info.variant === variant) return false;
      if (dispatch) {
        const node = state.doc.nodeAt(info.pos);
        if (!node) return false;
        dispatch(
          state.tr.setNodeMarkup(info.pos, undefined, {
            ...node.attrs,
            variant,
          }),
        );
      }
      return true;
    }
    return wrapIn(calloutType, { variant })(state, dispatch, view);
  };
}

export function unsetCallout(calloutType: NodeType): Command {
  return (state, dispatch) => {
    if (!findCalloutAtSelection(state, calloutType)) return false;
    return lift(state, dispatch);
  };
}

function CalloutToolbarItem() {
  const { schema } = useEditor();
  const editorState = useEditorState();
  const calloutType = schema.nodes["callout"];

  const apply = useEditorEventCallback((view, variant: CalloutVariant) => {
    if (!view || !calloutType) return;
    setCallout(calloutType, variant)(view.state, view.dispatch, view);
    view.focus();
  });

  const remove = useEditorEventCallback((view) => {
    if (!view || !calloutType) return;
    unsetCallout(calloutType)(view.state, view.dispatch);
    view.focus();
  });

  if (!calloutType) return null;

  const info = findCalloutAtSelection(editorState as EditorState, calloutType);
  const active = !!info;
  const ActiveCfg =
    CALLOUT_VARIANTS.find((v) => v.id === info?.variant) ?? CALLOUT_VARIANTS[0]!;
  const ActiveIcon = ActiveCfg.Icon;

  return (
    <Dropdown
      label={<ActiveIcon size={18} weight="bold" />}
      title="Callout"
      tooltip="Callout"
      hideCaret
      triggerActive={active}
      triggerStyle={{ width: 30, padding: 0, gap: 0 }}
    >
      {CALLOUT_VARIANTS.map((v) => {
        const Icon = v.Icon;
        return (
          <RadixDropdownMenu.Item
            key={v.id}
            className="pp-dropdown-item pp-callout-menu-item"
            data-active={info?.variant === v.id || undefined}
            onMouseDown={(e) => e.preventDefault()}
            onSelect={(e) => {
              e.preventDefault();
              apply(v.id);
            }}
          >
            <span
              className={`pp-callout-swatch pp-callout-swatch--${v.id}`}
              aria-hidden
            >
              <Icon size={12} weight="bold" />
            </span>
            <span>{v.label}</span>
          </RadixDropdownMenu.Item>
        );
      })}
      {active && (
        <>
          <RadixDropdownMenu.Separator className="pp-dropdown-separator" />
          <RadixDropdownMenu.Item
            className="pp-dropdown-item"
            onMouseDown={(e) => e.preventDefault()}
            onSelect={(e) => {
              e.preventDefault();
              remove();
            }}
          >
            Remove callout
          </RadixDropdownMenu.Item>
        </>
      )}
    </Dropdown>
  );
}

export const Callout = Extension.create({
  name: "callout",
  nodes: { callout: calloutSpec },
  isActive: (state, schema) =>
    isAncestorActive(state, schema.nodes["callout"]!),
  toolbar: CalloutToolbarItem,
  meta: { label: "Callout", group: "block", Icon: Note },
});
