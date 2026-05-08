import { FileX } from "@phosphor-icons/react";
import type { NodeSpec, NodeType } from "prosemirror-model";
import { Plugin, TextSelection, type Command } from "prosemirror-state";
import type { EditorView, NodeView } from "prosemirror-view";

import { Extension } from "../types";
import {
  measurePageBreakFillHeight,
  registerPageBreakNodeView,
} from "./Pages";

const pageBreakSpec: NodeSpec = {
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  parseDOM: [{ tag: 'div[data-type="page-break"]' }],
  toDOM: () => [
    "div",
    { "data-type": "page-break", class: "pp-page-break-node" },
  ],
};

class PageBreakNodeView implements NodeView {
  dom: HTMLElement;
  private cleanup: (() => void) | null = null;
  private lastFill = 0;

  constructor(view: EditorView) {
    this.dom = document.createElement("div");
    this.dom.setAttribute("data-type", "page-break");
    this.dom.classList.add("pp-page-break-node");

    const pagesInstalled = view.dom.classList.contains("ProseMirror--pages");
    if (pagesInstalled) {
      this.dom.classList.add("pp-page-break-node--pages-mode");
      const recalc = () => {
        const fill = measurePageBreakFillHeight(this.dom, view.dom);
        if (fill === null) return;
        if (Math.abs(fill - this.lastFill) < 1) return;
        this.lastFill = fill;
        this.dom.style.height = fill > 0 ? `${fill}px` : "";
      };
      this.cleanup = registerPageBreakNodeView(view, this.dom, recalc);
    } else {
      // Standalone rendering: a labeled horizontal rule.
      const ruleA = document.createElement("div");
      ruleA.classList.add("pp-page-break-node__rule");
      const label = document.createElement("span");
      label.classList.add("pp-page-break-node__label");
      label.textContent = "Page break";
      const ruleB = document.createElement("div");
      ruleB.classList.add("pp-page-break-node__rule");
      this.dom.appendChild(ruleA);
      this.dom.appendChild(label);
      this.dom.appendChild(ruleB);
    }
  }

  destroy() {
    this.cleanup?.();
  }
}

function insertPageBreakCommand(pageBreakType: NodeType): Command {
  return (state, dispatch) => {
    const { $from } = state.selection;
    if (!$from.parent.canReplaceWith($from.index(), $from.index(), pageBreakType)) {
      const after = $from.after($from.depth);
      if (dispatch) {
        const tr = state.tr;
        tr.insert(after, pageBreakType.create());
        const paragraphType = state.schema.nodes["paragraph"];
        const newAfter = after + 1;
        if (paragraphType && !tr.doc.nodeAt(newAfter)) {
          tr.insert(newAfter, paragraphType.create());
        }
        tr.setSelection(TextSelection.create(tr.doc, newAfter + 1));
        dispatch(tr.scrollIntoView());
      }
      return true;
    }
    if (dispatch) {
      const tr = state.tr.replaceSelectionWith(pageBreakType.create()).scrollIntoView();
      const paragraphType = state.schema.nodes["paragraph"];
      if (paragraphType) {
        const after = tr.selection.$from.after();
        if (!tr.doc.nodeAt(after)) {
          tr.insert(after, paragraphType.create());
        }
        tr.setSelection(TextSelection.create(tr.doc, after + 1));
      }
      dispatch(tr);
    }
    return true;
  };
}

export const PageBreak = Extension.create({
  name: "page-break",
  nodes: { page_break: pageBreakSpec },
  commands: {
    insertPageBreak: (schema) =>
      insertPageBreakCommand(schema.nodes["page_break"]!),
  },
  keymap: {
    "Mod-Enter": "insertPageBreak",
  },
  plugins: (schema) => {
    const pageBreakType = schema.nodes["page_break"];
    if (!pageBreakType) return [];
    return [
      new Plugin({
        props: {
          nodeViews: {
            page_break: (_node, view) => new PageBreakNodeView(view),
          },
        },
      }),
    ];
  },
  meta: {
    label: "Page break",
    group: "block",
    Icon: FileX,
    shortcut: "Mod-Enter",
  },
});
