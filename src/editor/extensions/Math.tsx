import { MathOperations } from "@phosphor-icons/react";
import {
  useEditorEffect,
  useEditorEventCallback,
  useEditorState,
} from "@handlewithcare/react-prosemirror";
import * as RadixPopover from "@radix-ui/react-popover";
import katex, { type KatexOptions } from "katex";
import "katex/dist/katex.min.css";
import { InputRule } from "prosemirror-inputrules";
import type { Node, NodeSpec, NodeType } from "prosemirror-model";
import {
  NodeSelection,
  Plugin,
  TextSelection,
  type Command,
  type EditorState,
  type Transaction,
} from "prosemirror-state";
import type { EditorView, NodeView } from "prosemirror-view";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { useEditor } from "../Editor";
import { MenuItem } from "../menu/MenuItem";
import { Extension } from "../types";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const inlineMathSpec: NodeSpec = {
  inline: true,
  group: "inline",
  atom: true,
  selectable: true,
  draggable: false,
  attrs: { latex: { default: "" } },
  parseDOM: [
    {
      tag: 'span[data-type="inline-math"]',
      getAttrs(dom) {
        if (!(dom instanceof HTMLElement)) return false;
        return { latex: dom.getAttribute("data-latex") ?? dom.textContent ?? "" };
      },
    },
  ],
  toDOM(node) {
    return [
      "span",
      {
        "data-type": "inline-math",
        "data-latex": (node.attrs["latex"] as string) || "",
      },
    ];
  },
};

const blockMathSpec: NodeSpec = {
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  attrs: { latex: { default: "" } },
  parseDOM: [
    {
      tag: 'div[data-type="block-math"]',
      getAttrs(dom) {
        if (!(dom instanceof HTMLElement)) return false;
        return { latex: dom.getAttribute("data-latex") ?? dom.textContent ?? "" };
      },
    },
  ],
  toDOM(node) {
    return [
      "div",
      {
        "data-type": "block-math",
        "data-latex": (node.attrs["latex"] as string) || "",
      },
    ];
  },
};

// ---------------------------------------------------------------------------
// Inline math NodeView — render-only. Editing happens in MathInlinePopover.
// ---------------------------------------------------------------------------

class InlineMathNodeView implements NodeView {
  dom: HTMLSpanElement;
  private node: Node;
  private katexOptions?: KatexOptions;

  constructor(node: Node, katexOptions?: KatexOptions) {
    this.node = node;
    this.katexOptions = katexOptions;
    this.dom = document.createElement("span");
    this.dom.className = "pp-math pp-math--inline";
    this.dom.dataset["type"] = "inline-math";
    this.render();
  }

  private render() {
    const latex = (this.node.attrs["latex"] as string) || "";
    if (!latex) {
      this.dom.classList.add("pp-math--empty");
      this.dom.textContent = "math";
      return;
    }
    try {
      katex.render(latex, this.dom, {
        displayMode: false,
        throwOnError: false,
        ...this.katexOptions,
      });
      this.dom.dataset["latex"] = latex;
      this.dom.classList.remove("pp-math--error", "pp-math--empty");
    } catch {
      this.dom.classList.add("pp-math--error");
      this.dom.textContent = latex;
    }
  }

  update(node: Node) {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.render();
    return true;
  }

  ignoreMutation() {
    return true;
  }
}

// ---------------------------------------------------------------------------
// Block math NodeView — swaps to a textarea + live preview when selected.
// ---------------------------------------------------------------------------

class BlockMathNodeView implements NodeView {
  dom: HTMLDivElement;
  private node: Node;
  private view: EditorView;
  private getPos: () => number | undefined;
  private katexOptions?: KatexOptions;
  private editing = false;
  private textarea: HTMLTextAreaElement | null = null;
  private preview: HTMLDivElement | null = null;
  private suppressBlur = false;

  constructor(
    node: Node,
    view: EditorView,
    getPos: () => number | undefined,
    katexOptions?: KatexOptions,
  ) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;
    this.katexOptions = katexOptions;

    this.dom = document.createElement("div");
    this.dom.className = "pp-math pp-math--block";
    if (view.editable) this.dom.classList.add("pp-math--editable");
    this.dom.dataset["type"] = "block-math";
    this.renderRendered();
  }

  private renderRendered() {
    this.dom.classList.remove("pp-math--editing");
    this.dom.innerHTML = "";
    const target = document.createElement("div");
    this.dom.appendChild(target);
    const latex = (this.node.attrs["latex"] as string) || "";
    if (!latex) {
      this.dom.classList.add("pp-math--empty");
      target.textContent = "Empty block math — click to edit";
      return;
    }
    this.dom.classList.remove("pp-math--empty");
    try {
      katex.render(latex, target, {
        displayMode: true,
        throwOnError: false,
        ...this.katexOptions,
      });
      this.dom.dataset["latex"] = latex;
      this.dom.classList.remove("pp-math--error");
    } catch {
      this.dom.classList.add("pp-math--error");
      target.textContent = latex;
    }
  }

  private renderEditing() {
    this.dom.classList.add("pp-math--editing");
    this.dom.classList.remove("pp-math--empty", "pp-math--error");
    this.dom.innerHTML = "";

    const textarea = document.createElement("textarea");
    textarea.className = "pp-math-edit-input";
    textarea.value = (this.node.attrs["latex"] as string) || "";
    textarea.rows = 3;
    textarea.placeholder = "LaTeX, e.g. \\int_a^b x^2 \\, dx";
    textarea.spellcheck = false;

    const preview = document.createElement("div");
    preview.className = "pp-math-edit-preview";

    const hint = document.createElement("div");
    hint.className = "pp-math-edit-hint";
    hint.textContent = "Click outside or press Esc to finish";

    this.dom.appendChild(textarea);
    this.dom.appendChild(preview);
    this.dom.appendChild(hint);

    this.textarea = textarea;
    this.preview = preview;

    this.renderPreview(textarea.value);

    textarea.addEventListener("input", () => this.renderPreview(textarea.value));
    textarea.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        this.suppressBlur = true;
        this.cancel();
      } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        this.suppressBlur = true;
        this.commit(textarea.value, true);
      }
    });
    textarea.addEventListener("blur", () => {
      if (this.suppressBlur) {
        this.suppressBlur = false;
        return;
      }
      this.commit(textarea.value, false);
    });
    // Keep selection on this node while interacting with the textarea.
    textarea.addEventListener("mousedown", (e) => e.stopPropagation());

    requestAnimationFrame(() => textarea.focus());
  }

  private renderPreview(latex: string) {
    if (!this.preview) return;
    if (!latex.trim()) {
      this.preview.textContent = "Preview";
      this.preview.classList.add("pp-math-edit-preview--empty");
      return;
    }
    this.preview.classList.remove("pp-math-edit-preview--empty");
    try {
      katex.render(latex, this.preview, {
        displayMode: true,
        throwOnError: false,
        ...this.katexOptions,
      });
    } catch {
      this.preview.textContent = latex;
    }
  }

  private commit(latex: string, moveCursorAfter: boolean) {
    const pos = this.getPos();
    this.editing = false;
    this.textarea = null;
    this.preview = null;
    if (pos == null) {
      this.renderRendered();
      return;
    }
    const tr = this.view.state.tr;
    if (latex !== this.node.attrs["latex"]) {
      tr.setNodeMarkup(pos, undefined, { ...this.node.attrs, latex });
    }
    if (moveCursorAfter) {
      const after = pos + this.node.nodeSize;
      tr.setSelection(TextSelection.create(tr.doc, after));
    }
    if (tr.docChanged || moveCursorAfter) {
      this.view.dispatch(tr);
    } else {
      this.renderRendered();
    }
    if (moveCursorAfter) this.view.focus();
  }

  private cancel() {
    const pos = this.getPos();
    this.editing = false;
    this.textarea = null;
    this.preview = null;
    this.renderRendered();
    if (pos == null) return;
    const after = pos + this.node.nodeSize;
    this.view.dispatch(
      this.view.state.tr.setSelection(TextSelection.create(this.view.state.doc, after)),
    );
    this.view.focus();
  }

  selectNode() {
    if (this.editing || !this.view.editable) return;
    this.editing = true;
    this.renderEditing();
  }

  deselectNode() {
    if (!this.editing) return;
    if (this.textarea) {
      this.commit(this.textarea.value, false);
    } else {
      this.editing = false;
      this.renderRendered();
    }
  }

  update(node: Node) {
    if (node.type !== this.node.type) return false;
    this.node = node;
    if (!this.editing) {
      this.renderRendered();
    }
    return true;
  }

  stopEvent(event: Event) {
    if (!this.editing || !this.textarea) return false;
    if (!(event.target instanceof HTMLElement)) return false;
    return this.textarea.contains(event.target);
  }

  ignoreMutation() {
    return true;
  }
}

// ---------------------------------------------------------------------------
// Plugin: handle clicks on math nodes — set NodeSelection so the NodeView's
// selectNode lifecycle (and the inline popover) fires.
// ---------------------------------------------------------------------------

function buildMathPlugin(
  inlineType: NodeType,
  blockType: NodeType,
  katexOptions?: KatexOptions,
) {
  return new Plugin({
    props: {
      nodeViews: {
        inline_math: (node) => new InlineMathNodeView(node, katexOptions),
        block_math: (node, view, getPos) =>
          new BlockMathNodeView(
            node,
            view,
            getPos as () => number | undefined,
            katexOptions,
          ),
      },
      handleClickOn(view, _pos, node, nodePos, event) {
        if (node.type !== inlineType && node.type !== blockType) return false;
        if (!view.editable) return false;
        event.preventDefault();
        view.dispatch(
          view.state.tr.setSelection(NodeSelection.create(view.state.doc, nodePos)),
        );
        return true;
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Inline anchored popover — appears next to a selected inline_math node.
// ---------------------------------------------------------------------------

export function MathInlinePopover() {
  const editorState = useEditorState();
  const { schema } = useEditor();
  const inlineType = schema.nodes["inline_math"];

  const isSelected =
    !!inlineType &&
    !!editorState &&
    editorState.selection instanceof NodeSelection &&
    editorState.selection.node.type === inlineType;

  const selectionPos = isSelected ? editorState.selection.from : null;
  const selectionLatex = isSelected
    ? ((editorState.selection as NodeSelection).node.attrs["latex"] as string) ?? ""
    : "";

  const [coords, setCoords] = useState<{ left: number; top: number } | null>(null);
  const [draft, setDraft] = useState("");
  const previewRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Re-anchor on selection change.
  useEditorEffect(
    (view) => {
      if (selectionPos == null || !inlineType) {
        setCoords(null);
        return;
      }
      const dom = view.nodeDOM(selectionPos);
      if (!(dom instanceof HTMLElement)) return;
      const rect = dom.getBoundingClientRect();
      setCoords({
        left: rect.left,
        top: rect.bottom + 6,
      });
    },
    [selectionPos],
  );

  // Reset draft when a different node is selected.
  useEffect(() => {
    if (selectionPos != null) {
      setDraft(selectionLatex);
    }
    // selectionPos in deps so a re-selection of a different node resets too
  }, [selectionPos, selectionLatex]);

  // Live preview.
  useLayoutEffect(() => {
    if (!previewRef.current) return;
    const target = previewRef.current;
    if (!draft.trim()) {
      target.textContent = "Preview";
      target.classList.add("pp-math-edit-preview--empty");
      return;
    }
    target.classList.remove("pp-math-edit-preview--empty");
    try {
      katex.render(draft, target, { displayMode: false, throwOnError: false });
    } catch {
      target.textContent = draft;
    }
  }, [draft]);

  // Focus textarea when popover appears.
  useEffect(() => {
    if (coords && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [coords && selectionPos]);

  const commit = useEditorEventCallback((view, value: string) => {
    if (!view || selectionPos == null || !inlineType) return;
    const node = view.state.doc.nodeAt(selectionPos);
    if (!node || node.type !== inlineType) return;
    if (value === node.attrs["latex"]) return;
    view.dispatch(
      view.state.tr.setNodeMarkup(selectionPos, undefined, {
        ...node.attrs,
        latex: value,
      }),
    );
  });

  const cancel = useEditorEventCallback((view) => {
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
      ref={containerRef}
      className="pp-math-inline-popover"
      style={{
        position: "fixed",
        left: coords.left,
        top: coords.top,
        zIndex: 100,
      }}
      // Don't let outside-click handlers in the editor steal focus while
      // the user clicks within the popover.
      onMouseDown={(e) => e.stopPropagation()}
    >
      <textarea
        ref={textareaRef}
        className="pp-math-edit-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            commit(draft);
            cancel();
          }
        }}
        rows={1}
        spellCheck={false}
        placeholder="\frac{a}{b}"
      />
      <div ref={previewRef} className="pp-math-edit-preview pp-math-edit-preview--empty">
        Preview
      </div>
      <div className="pp-math-edit-hint">⌘↩ to commit · Esc to dismiss</div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Insert commands
// ---------------------------------------------------------------------------

function insertInlineMathCommand(type: NodeType, latex: string): Command {
  return (state, dispatch) => {
    if (!latex) return false;
    if (dispatch) {
      dispatch(
        state.tr.replaceSelectionWith(type.create({ latex }), false).scrollIntoView(),
      );
    }
    return true;
  };
}

function insertBlockMathCommand(type: NodeType, latex: string): Command {
  return (state, dispatch) => {
    if (!latex) return false;
    if (dispatch) {
      dispatch(
        state.tr.replaceSelectionWith(type.create({ latex })).scrollIntoView(),
      );
    }
    return true;
  };
}

// ---------------------------------------------------------------------------
// Migrate `$...$` text strings → inlineMath nodes (post-mount).
// ---------------------------------------------------------------------------

const DOLLAR_PAIR = /\$(?!\d+\$)([^\n$]+?)\$(?!\d)/g;

export function migrateMathStringsTransaction(
  state: EditorState,
  inlineType: NodeType,
  pattern = DOLLAR_PAIR,
): Transaction | null {
  const tr = state.tr;
  let modified = false;
  state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text || !node.text.includes("$")) return;
    const text = node.text;
    let match: RegExpExecArray | null;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0]!.length;
      const from = tr.mapping.map(pos + start);
      const to = tr.mapping.map(pos + end);
      const $pos = tr.doc.resolve(from);
      const parent = $pos.parent;
      const idx = $pos.index();
      if (parent.canReplaceWith(idx, idx + 1, inlineType)) {
        tr.replaceWith(from, to, inlineType.create({ latex: match[1] }));
        modified = true;
      }
    }
  });
  if (!modified) return null;
  return tr.setMeta("addToHistory", false);
}

export function migrateMathStrings(
  view: EditorView,
  inlineType: NodeType,
  pattern?: RegExp,
) {
  const tr = migrateMathStringsTransaction(view.state, inlineType, pattern);
  if (tr) view.dispatch(tr);
}

// ---------------------------------------------------------------------------
// Toolbar — single popover for INSERT (existing math edits in place).
// ---------------------------------------------------------------------------

function MathToolbarItem() {
  const { schema } = useEditor();
  const inlineType = schema.nodes["inline_math"];
  const blockType = schema.nodes["block_math"];

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"inline" | "block">("inline");
  const [latex, setLatex] = useState("");
  const previewRef = useRef<HTMLDivElement>(null);

  const insert = useEditorEventCallback(
    (view, m: "inline" | "block", value: string) => {
      if (!view) return;
      if (m === "inline" && inlineType) {
        insertInlineMathCommand(inlineType, value)(view.state, view.dispatch);
      } else if (m === "block" && blockType) {
        insertBlockMathCommand(blockType, value)(view.state, view.dispatch);
      }
      view.focus();
    },
  );

  useEffect(() => {
    if (!open || !previewRef.current) return;
    const target = previewRef.current;
    if (!latex.trim()) {
      target.textContent = "Preview";
      target.classList.add("pp-math-preview--empty");
      return;
    }
    target.classList.remove("pp-math-preview--empty");
    try {
      katex.render(latex, target, {
        displayMode: mode === "block",
        throwOnError: false,
      });
    } catch {
      target.textContent = latex;
    }
  }, [latex, mode, open]);

  if (!inlineType || !blockType) return null;

  return (
    <RadixPopover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setLatex("");
      }}
    >
      <RadixPopover.Trigger asChild>
        <MenuItem tooltip="Insert math (LaTeX)">
          <MathOperations size={18} weight="bold" />
        </MenuItem>
      </RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          className="pp-popover pp-math-popover"
          side="bottom"
          align="start"
          sideOffset={6}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <form
            className="pp-image-form"
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = latex.trim();
              if (!trimmed) return;
              insert(mode, trimmed);
              setOpen(false);
            }}
          >
            <div className="pp-math-mode" role="radiogroup" aria-label="Math mode">
              <label className="pp-math-mode-option">
                <input
                  type="radio"
                  name="pp-math-mode-insert"
                  value="inline"
                  checked={mode === "inline"}
                  onChange={() => setMode("inline")}
                />
                Inline
              </label>
              <label className="pp-math-mode-option">
                <input
                  type="radio"
                  name="pp-math-mode-insert"
                  value="block"
                  checked={mode === "block"}
                  onChange={() => setMode("block")}
                />
                Block
              </label>
            </div>
            <label className="pp-popover-label">LaTeX</label>
            <textarea
              className="pp-popover-input pp-math-input"
              placeholder="\frac{a}{b}"
              value={latex}
              onChange={(e) => setLatex(e.target.value)}
              autoFocus
              rows={3}
              spellCheck={false}
            />
            <div ref={previewRef} className="pp-math-preview pp-math-preview--empty">
              Preview
            </div>
            <div className="pp-image-actions">
              <button type="submit" className="pp-popover-btn pp-popover-btn-primary">
                Insert
              </button>
            </div>
          </form>
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export interface MathOptions {
  /** KaTeX render options. https://katex.org/docs/options.html */
  katexOptions?: KatexOptions;
}

export function createMath({ katexOptions }: MathOptions = {}) {
  return Extension.create({
    name: "math",
    nodes: {
      inline_math: inlineMathSpec,
      block_math: blockMathSpec,
    },
    inputRules: (schema) => {
      const inlineType = schema.nodes["inline_math"];
      const blockType = schema.nodes["block_math"];
      const rules: InputRule[] = [];
      if (inlineType) {
        // $x$ — inline. Triggers when the user types the closing $.
        rules.push(
          new InputRule(/\$([^$\n]+)\$$/, (state, match, start, end) => {
            const latex = match[1];
            if (!latex) return null;
            return state.tr.replaceWith(start, end, inlineType.create({ latex }));
          }),
        );
      }
      if (blockType) {
        // $$x$$ on its own line — block.
        rules.push(
          new InputRule(/^\$\$([^$\n]+)\$\$$/, (state, match, start, end) => {
            const latex = match[1];
            if (!latex) return null;
            const tr = state.tr.delete(start, end);
            const range = tr.doc.resolve(start).blockRange();
            if (!range) return null;
            tr.replaceRangeWith(range.start, range.end, blockType.create({ latex }));
            return tr;
          }),
        );
      }
      return rules;
    },
    plugins: (schema) => {
      const inlineType = schema.nodes["inline_math"];
      const blockType = schema.nodes["block_math"];
      if (!inlineType || !blockType) return [];
      return [buildMathPlugin(inlineType, blockType, katexOptions)];
    },
    isActive: (state, schema) => {
      const inlineType = schema.nodes["inline_math"];
      const blockType = schema.nodes["block_math"];
      if (!inlineType || !blockType) return false;
      const sel = state.selection;
      return (
        sel instanceof NodeSelection &&
        (sel.node.type === inlineType || sel.node.type === blockType)
      );
    },
    toolbar: () => <MathToolbarItem />,
    meta: { label: "Math", group: "block", Icon: MathOperations },
  });
}

export const Math = createMath();
