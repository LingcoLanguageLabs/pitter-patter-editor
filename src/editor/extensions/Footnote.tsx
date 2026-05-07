import { ListNumbers } from "@phosphor-icons/react";
import { useEditorState } from "@handlewithcare/react-prosemirror";
import { InputRule } from "prosemirror-inputrules";
import { Fragment, Slice, type Node, type NodeSpec, type NodeType } from "prosemirror-model";
import {
  NodeSelection,
  Plugin,
  PluginKey,
  TextSelection,
  type Command,
  type EditorState,
  type Transaction,
} from "prosemirror-state";
import { ReplaceStep } from "prosemirror-transform";
import type { EditorView } from "prosemirror-view";

import { useEditor } from "../Editor";
import { CommandItem } from "../menu";
import { Extension } from "../types";

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `fn-${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const footnoteReferenceSpec: NodeSpec = {
  inline: true,
  group: "inline",
  atom: true,
  draggable: true,
  attrs: {
    "data-id": { default: null },
    referenceNumber: { default: "" },
  },
  parseDOM: [
    {
      tag: "sup.pp-footnote-ref-host",
      priority: 1000,
      getAttrs(dom) {
        if (!(dom instanceof HTMLElement)) return false;
        const anchor = dom.querySelector<HTMLAnchorElement>("a.pp-footnote-ref");
        if (!anchor) return false;
        return {
          "data-id": anchor.getAttribute("data-id") ?? generateId(),
          referenceNumber:
            anchor.getAttribute("data-reference-number") ??
            anchor.textContent ??
            "",
        };
      },
    },
  ],
  toDOM(node) {
    const ref = (node.attrs["referenceNumber"] as string) || "";
    const id = (node.attrs["data-id"] as string) || "";
    return [
      "sup",
      { class: "pp-footnote-ref-host", id: ref ? `fnref:${ref}` : "" },
      [
        "a",
        {
          class: "pp-footnote-ref",
          href: ref ? `#fn:${ref}` : "#",
          "data-id": id,
          "data-reference-number": ref,
        },
        ref,
      ],
    ];
  },
};

const footnoteSpec: NodeSpec = {
  content: "paragraph+",
  defining: true,
  isolating: true,
  draggable: false,
  attrs: {
    "data-id": { default: null },
    id: { default: null },
  },
  parseDOM: [
    {
      tag: "li[data-footnote]",
      priority: 1000,
      getAttrs(dom) {
        if (!(dom instanceof HTMLElement)) return false;
        return {
          "data-id": dom.getAttribute("data-id"),
          id: dom.getAttribute("id"),
        };
      },
    },
  ],
  toDOM(node) {
    const id = (node.attrs["id"] as string) || "";
    return [
      "li",
      {
        "data-footnote": "",
        "data-id": (node.attrs["data-id"] as string) || "",
        ...(id ? { id } : {}),
      },
      0,
    ];
  },
};

const footnotesSpec: NodeSpec = {
  content: "footnote*",
  group: "block",
  defining: true,
  isolating: true,
  draggable: false,
  parseDOM: [{ tag: "ol.pp-footnotes-list", priority: 1000 }],
  toDOM() {
    return ["ol", { class: "pp-footnotes-list", "data-footnotes": "" }, 0];
  },
};

// ---------------------------------------------------------------------------
// Rebuild logic — keeps the footnotes list synced with the references
// ---------------------------------------------------------------------------

function collectReferences(doc: Node, refType: NodeType) {
  const refs: { dataId: string; pos: number }[] = [];
  doc.descendants((node, pos) => {
    if (node.type === refType) {
      refs.push({ dataId: node.attrs["data-id"] as string, pos });
      return false;
    }
    return undefined;
  });
  return refs;
}

function findFootnotes(doc: Node, footnotesType: NodeType) {
  let range: { from: number; to: number; node: Node } | null = null;
  doc.descendants((node, pos) => {
    if (node.type === footnotesType) {
      range = { from: pos, to: pos + node.nodeSize, node };
      return false;
    }
    return undefined;
  });
  return range as { from: number; to: number; node: Node } | null;
}

function rebuildFootnotes(
  tr: Transaction,
  state: EditorState,
  refType: NodeType,
  footnoteType: NodeType,
  footnotesType: NodeType,
) {
  // 1. Renumber references in doc order
  const refs = collectReferences(tr.doc, refType);
  refs.forEach((ref, i) => {
    const node = tr.doc.nodeAt(ref.pos);
    if (!node) return;
    const newNumber = String(i + 1);
    if (node.attrs["referenceNumber"] !== newNumber) {
      tr.setNodeMarkup(ref.pos, undefined, {
        ...node.attrs,
        referenceNumber: newNumber,
      });
    }
  });

  // 2. Pull existing footnotes by data-id so we can preserve their content
  const existing = findFootnotes(tr.doc, footnotesType);
  const existingById = new Map<string, Node>();
  if (existing) {
    existing.node.content.forEach((child) => {
      if (child.type === footnoteType) {
        existingById.set(child.attrs["data-id"] as string, child);
      }
    });
  }

  // 3. Build the new footnote list matching the references
  const paragraphType = state.schema.nodes["paragraph"];
  if (!paragraphType) return;

  const newEntries: Node[] = [];
  for (let i = 0; i < refs.length; i++) {
    const refId = refs[i]!.dataId;
    const fnId = `fn:${i + 1}`;
    const prior = existingById.get(refId);
    if (prior) {
      newEntries.push(
        footnoteType.create(
          { "data-id": refId, id: fnId },
          prior.content,
        ),
      );
    } else {
      newEntries.push(
        footnoteType.create(
          { "data-id": refId, id: fnId },
          paragraphType.create(),
        ),
      );
    }
  }

  // 4. Splice into the doc
  if (newEntries.length === 0) {
    if (existing) tr.delete(existing.from, existing.to);
    return;
  }
  if (!existing) {
    tr.insert(
      tr.doc.content.size,
      footnotesType.create(null, Fragment.from(newEntries)),
    );
    return;
  }
  // Replace the footnotes' content (between the open/close tokens)
  tr.replaceWith(
    existing.from + 1,
    existing.to - 1,
    Fragment.from(newEntries),
  );
}

// ---------------------------------------------------------------------------
// Plugin: filter / append / paste / click
// ---------------------------------------------------------------------------

const footnoteRulesKey = new PluginKey("pp-footnote-rules");

function buildFootnotePlugin(
  refType: NodeType,
  footnoteType: NodeType,
  footnotesType: NodeType,
) {
  return new Plugin({
    key: footnoteRulesKey,

    // Don't allow edits that span body + footnotes, or touch >1 footnote.
    filterTransaction(tr, state) {
      const { from, to } = tr.selection;
      if (from === 0 && to === tr.doc.content.size) return true;

      let touchesContent = false;
      let touchesFootnotes = false;
      let footnoteCount = 0;
      tr.doc.nodesBetween(from, to, (node, _pos, parent) => {
        if (parent?.type === state.schema.topNodeType && node.type !== footnotesType) {
          touchesContent = true;
        } else if (node.type === footnoteType) {
          footnoteCount += 1;
        } else if (node.type === footnotesType) {
          touchesFootnotes = true;
        }
        return undefined;
      });
      if (touchesContent && touchesFootnotes) return false;
      if (footnoteCount > 1) return false;
      return true;
    },

    // When references are added/removed, renumber and rebuild the list.
    appendTransaction(transactions, _oldState, newState) {
      let refsTouched = false;
      for (const tr of transactions) {
        if (!tr.docChanged) continue;
        if (refsTouched) break;
        for (const step of tr.steps) {
          if (!(step instanceof ReplaceStep)) continue;
          // Inserted refs?
          if (step.slice.size > 0) {
            step.slice.content.descendants((n) => {
              if (n.type === refType) {
                refsTouched = true;
                return false;
              }
              return undefined;
            });
          }
          // Deleted refs?
          if (!refsTouched && step.from !== step.to) {
            tr.before.nodesBetween(
              step.from,
              Math.min(tr.before.content.size, step.to),
              (n) => {
                if (n.type === refType) {
                  refsTouched = true;
                  return false;
                }
                return undefined;
              },
            );
          }
          if (refsTouched) break;
        }
      }
      if (!refsTouched) return null;

      const tr = newState.tr;
      rebuildFootnotes(tr, newState, refType, footnoteType, footnotesType);
      if (!tr.docChanged && !tr.selectionSet) return null;
      return tr;
    },

    props: {
      // Pasted refs need fresh data-ids so they don't collide.
      transformPasted(slice) {
        const mapNode = (node: Node): Node => {
          if (node.type === refType) {
            return node.type.create(
              { ...node.attrs, "data-id": generateId() },
              node.content,
              node.marks,
            );
          }
          if (node.content.size > 0) {
            const children: Node[] = [];
            let changed = false;
            node.content.forEach((child) => {
              const mapped = mapNode(child);
              if (mapped !== child) changed = true;
              children.push(mapped);
            });
            if (changed) return node.copy(Fragment.from(children));
          }
          return node;
        };

        const children: Node[] = [];
        let changed = false;
        slice.content.forEach((child) => {
          const mapped = mapNode(child);
          if (mapped !== child) changed = true;
          children.push(mapped);
        });
        if (!changed) return slice;
        return new Slice(Fragment.from(children), slice.openStart, slice.openEnd);
      },

      // Click a ref to select it; click again (or double-click) to jump.
      handleClickOn(view, _pos, node, nodePos, event) {
        if (node.type !== refType) return false;
        event.preventDefault();
        const { selection } = view.state;
        if (selection instanceof NodeSelection && selection.from === nodePos) {
          return focusFootnote(view, footnoteType, node.attrs["data-id"] as string);
        }
        view.dispatch(
          view.state.tr.setSelection(
            NodeSelection.create(view.state.doc, nodePos),
          ),
        );
        return true;
      },
      handleDoubleClickOn(view, _pos, node, _nodePos, event) {
        if (node.type !== refType) return false;
        event.preventDefault();
        return focusFootnote(view, footnoteType, node.attrs["data-id"] as string);
      },
    },
  });
}

function findFootnoteByDataId(
  doc: Node,
  footnoteType: NodeType,
  dataId: string,
): { pos: number; node: Node } | null {
  let result: { pos: number; node: Node } | null = null;
  doc.descendants((node, pos) => {
    if (result) return false;
    if (node.type === footnoteType && node.attrs["data-id"] === dataId) {
      result = { pos, node };
      return false;
    }
    return undefined;
  });
  return result;
}

function focusFootnote(
  view: EditorView,
  footnoteType: NodeType,
  dataId: string,
): boolean {
  const target = findFootnoteByDataId(view.state.doc, footnoteType, dataId);
  if (!target) return false;
  const end = target.pos + target.node.nodeSize - 1;
  const tr = view.state.tr.setSelection(
    TextSelection.create(view.state.doc, end - 1),
  );
  view.dispatch(tr.scrollIntoView());
  view.focus();
  const dom = view.nodeDOM(target.pos);
  if (dom instanceof HTMLElement) {
    dom.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  return true;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function addFootnoteCommand(refType: NodeType): Command {
  return (state, dispatch) => {
    if (dispatch) {
      const node = refType.create({
        "data-id": generateId(),
        referenceNumber: "",
      });
      dispatch(state.tr.replaceSelectionWith(node, false).scrollIntoView());
    }
    return true;
  };
}

function findFootnoteDepth($from: EditorState["selection"]["$from"], footnoteType: NodeType): number {
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type === footnoteType) return d;
  }
  return -1;
}

function nextFootnoteCommand(footnoteType: NodeType): Command {
  return (state, dispatch) => {
    const { $from } = state.selection;
    const depth = findFootnoteDepth($from, footnoteType);
    if (depth < 0) return false;
    const footnotePos = $from.before(depth);
    const footnoteSize = $from.node(depth).nodeSize;
    const after = footnotePos + footnoteSize;
    const nextNode = state.doc.nodeAt(after);
    if (!nextNode || nextNode.type !== footnoteType) return false;
    if (dispatch) {
      const target = after + nextNode.nodeSize - 2;
      dispatch(
        state.tr
          .setSelection(TextSelection.create(state.doc, target))
          .scrollIntoView(),
      );
    }
    return true;
  };
}

function prevFootnoteCommand(footnoteType: NodeType): Command {
  return (state, dispatch) => {
    const { $from } = state.selection;
    const depth = findFootnoteDepth($from, footnoteType);
    if (depth < 0) return false;
    const footnotePos = $from.before(depth);
    if (footnotePos === 0) return false;
    const before = state.doc.resolve(footnotePos).nodeBefore;
    if (!before || before.type !== footnoteType) return false;
    const target = footnotePos - 2;
    if (dispatch) {
      dispatch(
        state.tr
          .setSelection(TextSelection.create(state.doc, target))
          .scrollIntoView(),
      );
    }
    return true;
  };
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

function FootnoteToolbarItem() {
  const { schema } = useEditor();
  const editorState = useEditorState();
  const refType = schema.nodes["footnote_reference"];
  if (!refType) return null;

  const command = addFootnoteCommand(refType);
  const active = isInsideFootnote(editorState, schema.nodes["footnote"]);

  return (
    <CommandItem command={command} active={active} tooltip="Footnote">
      <ListNumbers size={18} weight="bold" />
    </CommandItem>
  );
}

function isInsideFootnote(
  state: EditorState | null,
  footnoteType: NodeType | undefined,
): boolean {
  if (!state || !footnoteType) return false;
  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type === footnoteType) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export const Footnote = Extension.create({
  name: "footnote",
  nodes: {
    footnote_reference: footnoteReferenceSpec,
    footnote: footnoteSpec,
    footnotes: footnotesSpec,
  },
  commands: {
    addFootnote: (schema) => addFootnoteCommand(schema.nodes["footnote_reference"]!),
    nextFootnote: (schema) => nextFootnoteCommand(schema.nodes["footnote"]!),
    prevFootnote: (schema) => prevFootnoteCommand(schema.nodes["footnote"]!),
  },
  keymap: {
    Tab: "nextFootnote",
    "Shift-Tab": "prevFootnote",
  },
  inputRules: (schema) => {
    const refType = schema.nodes["footnote_reference"];
    if (!refType) return [];
    // [^anything] inserts a footnote reference and discards the bracketed text.
    return [
      new InputRule(/\[\^([^\]]+?)\]$/, (state, match, start, end) => {
        if (!match[1]) return null;
        const tr = state.tr.delete(start, end);
        tr.insert(
          start,
          refType.create({ "data-id": generateId(), referenceNumber: "" }),
        );
        return tr;
      }),
    ];
  },
  plugins: (schema) => {
    const refType = schema.nodes["footnote_reference"];
    const footnoteType = schema.nodes["footnote"];
    const footnotesType = schema.nodes["footnotes"];
    if (!refType || !footnoteType || !footnotesType) return [];
    return [buildFootnotePlugin(refType, footnoteType, footnotesType)];
  },
  toolbar: FootnoteToolbarItem,
  meta: { label: "Footnote", group: "block", Icon: ListNumbers },
});
