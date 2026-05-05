import { CaretCircleDown } from "@phosphor-icons/react";
import { useEditorState } from "@handlewithcare/react-prosemirror";
import { InputRule } from "prosemirror-inputrules";
import type { Node as PmNode, NodeType } from "prosemirror-model";
import { Plugin } from "prosemirror-state";
import type { Command, EditorState } from "prosemirror-state";
import type { EditorView, NodeView, ViewMutationRecord } from "prosemirror-view";

import { useEditor } from "../Editor";
import { isAncestorActive } from "../helpers";
import { CommandItem } from "../menu";
import { Extension } from "../types";

function insertDetails(
  detailsType: NodeType,
  summaryType: NodeType,
  contentType: NodeType,
  paragraphType: NodeType,
): Command {
  return (state, dispatch) => {
    const node = detailsType.create({ open: true }, [
      summaryType.create(),
      contentType.create(null, paragraphType.create()),
    ]);
    if (!state.selection.$from.parent.canReplaceWith(
      state.selection.$from.index(),
      state.selection.$from.indexAfter(),
      detailsType,
    )) {
      return false;
    }
    if (dispatch) {
      dispatch(state.tr.replaceSelectionWith(node).scrollIntoView());
    }
    return true;
  };
}

class DetailsNodeView implements NodeView {
  dom: HTMLDetailsElement;
  contentDOM: HTMLDetailsElement;
  private view: EditorView;
  private getPos: () => number | undefined;
  private node: PmNode;
  private onToggle: (e: Event) => void;

  constructor(node: PmNode, view: EditorView, getPos: () => number | undefined) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;
    const dom = document.createElement("details");
    if (node.attrs["open"]) dom.setAttribute("open", "");
    this.dom = dom;
    this.contentDOM = dom;

    this.onToggle = () => {
      const pos = this.getPos();
      if (pos === undefined) return;
      const open = this.dom.open;
      if (this.node.attrs["open"] === open) return;
      const tr = this.view.state.tr.setNodeMarkup(pos, undefined, {
        ...this.node.attrs,
        open,
      });
      this.view.dispatch(tr);
    };
    dom.addEventListener("toggle", this.onToggle);
  }

  update(newNode: PmNode): boolean {
    if (newNode.type !== this.node.type) return false;
    this.node = newNode;
    const open = !!newNode.attrs["open"];
    if (this.dom.open !== open) {
      if (open) this.dom.setAttribute("open", "");
      else this.dom.removeAttribute("open");
    }
    return true;
  }

  stopEvent(event: Event): boolean {
    return event.type === "toggle" && event.target === this.dom;
  }

  ignoreMutation(mutation: ViewMutationRecord): boolean {
    if (mutation.type === "attributes" && mutation.attributeName === "open") {
      return true;
    }
    return false;
  }

  destroy() {
    this.dom.removeEventListener("toggle", this.onToggle);
  }
}

function DetailsToolbarItem() {
  const { schema } = useEditor();
  const editorState = useEditorState();
  const detailsType = schema.nodes["details"];
  const summaryType = schema.nodes["details_summary"];
  const contentType = schema.nodes["details_content"];
  const paragraphType = schema.nodes["paragraph"];
  if (!detailsType || !summaryType || !contentType || !paragraphType) return null;

  const command = insertDetails(detailsType, summaryType, contentType, paragraphType);
  const active = isAncestorActive(editorState as EditorState | null, detailsType);

  return (
    <CommandItem command={command} active={active} tooltip="Details">
      <CaretCircleDown size={18} weight="bold" />
    </CommandItem>
  );
}

export const Details = Extension.create({
  name: "details",
  nodes: {
    details: {
      attrs: { open: { default: true } },
      content: "details_summary details_content",
      group: "block",
      defining: true,
      parseDOM: [
        {
          tag: "details",
          getAttrs: (dom) => ({ open: (dom as HTMLElement).hasAttribute("open") }),
        },
      ],
      toDOM: (node) => ["details", node.attrs["open"] ? { open: "" } : {}, 0],
    },
    details_summary: {
      content: "inline*",
      defining: true,
      parseDOM: [{ tag: "summary" }],
      toDOM: () => ["summary", 0],
    },
    details_content: {
      content: "block+",
      defining: true,
      parseDOM: [{ tag: "div[data-type='details-content']" }],
      toDOM: () => ["div", { "data-type": "details-content" }, 0],
    },
  },
  commands: {
    "insert-details": (schema) =>
      insertDetails(
        schema.nodes["details"]!,
        schema.nodes["details_summary"]!,
        schema.nodes["details_content"]!,
        schema.nodes["paragraph"]!,
      ),
  },
  inputRules: (schema) => {
    const detailsType = schema.nodes["details"];
    const summaryType = schema.nodes["details_summary"];
    const contentType = schema.nodes["details_content"];
    const paragraphType = schema.nodes["paragraph"];
    if (!detailsType || !summaryType || !contentType || !paragraphType) return [];
    return [
      new InputRule(/^>>>\s$/, (state, _match, start, end) => {
        const $start = state.doc.resolve(start);
        if ($start.parent.type !== paragraphType) return null;
        if ($start.parent.content.size > end - start) return null;
        const node = detailsType.create({ open: true }, [
          summaryType.create(),
          contentType.create(null, paragraphType.create()),
        ]);
        const tr = state.tr.delete(start, end);
        const range = tr.doc.resolve(start).blockRange();
        if (!range) return null;
        tr.replaceRangeWith(range.start, range.end, node);
        return tr.scrollIntoView();
      }),
    ];
  },
  isActive: (state, schema) => isAncestorActive(state, schema.nodes["details"]!),
  plugins: () => [
    new Plugin({
      props: {
        nodeViews: {
          details: (node, view, getPos) =>
            new DetailsNodeView(node, view, getPos as () => number | undefined),
        },
      },
    }),
  ],
  toolbar: DetailsToolbarItem,
  meta: { label: "Details", group: "block", Icon: CaretCircleDown },
});
